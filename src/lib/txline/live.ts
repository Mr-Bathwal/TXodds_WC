import "server-only";
import type { Fixture, FeedEvent, LineupPlayer, LiveDetail, MatchEvent, MatchResult, MatchStatus, Odds, TxLineClient } from "./types";
import { resolveCountry } from "./countries";
import { getApiFootballDetail, type ApiFootballDetail } from "../api-football";
import { getEspnDetail } from "../espn";
import { fnv1a, seededRandom } from "../utils";

/**
 * Live TxLINE provider (server-side only).
 *
 * Real data flow (github.com/txodds/tx-on-chain + hosted quickstart):
 *   POST /auth/guest/start                                  -> short-lived JWT
 *   GET  /api/fixtures/snapshot?competitionId=&startEpochDay -> fixtures (windowed)
 *   GET  /api/odds/snapshot/{id}                            -> de-margined 1X2 (+%)
 *   GET  /api/scores/snapshot/{id}                          -> event stream (goals,
 *                                                             kickoff/finalised, clock)
 *   GET  /api/fixtures/validation?fixtureId={id}            -> Merkle root (on-chain proof)
 * All data requests send Authorization: Bearer <jwt> + X-Api-Token: <token>.
 *
 * Status is derived from score **Actions** (kickoff / halftime_finalised /
 * game_finalised) + the match Clock — the GameState field is unreliable. The
 * scoreline comes from `Score.ParticipantN.Total.Goals`.
 */

const HOST = process.env.TXLINE_HOST ?? "https://txline-dev.txodds.com";
const API_TOKEN = process.env.TXLINE_API_TOKEN ?? "";
const COMPETITIONS = (process.env.TXLINE_COMPETITIONS ?? "72").split(",").map((s) => s.trim());
const CLUSTER = (process.env.SOLANA_CLUSTER ?? "devnet") as "devnet" | "testnet" | "mainnet-beta";
// Devnet TxLINE program id — where the data Merkle roots are published on-chain.
const PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J";
const LIVE_CACHE_TTL = 2_500;
const STATIC_CACHE_TTL = 20_000;

/* ------------------------------ auth ------------------------------ */

let jwt = "";
let jwtAt = 0;
let jwtInflight: Promise<string> | null = null;

async function guestJwt(force = false): Promise<string> {
  if (!force && jwt && Date.now() - jwtAt < 10 * 60_000) return jwt;
  // Single-flight: on a cold start the day fan-out calls this ~10× at once;
  // share one /auth/guest/start request instead of stampeding the endpoint.
  if (!force && jwtInflight) return jwtInflight;
  jwtInflight = (async () => {
    const res = await fetch(`${HOST}/auth/guest/start`, { method: "POST", cache: "no-store" });
    if (!res.ok) throw new Error(`guest/start ${res.status}`);
    jwt = ((await res.json()) as { token: string }).token;
    jwtAt = Date.now();
    return jwt;
  })();
  try {
    return await jwtInflight;
  } finally {
    jwtInflight = null;
  }
}

async function apiGet<T>(path: string): Promise<T> {
  const call = async () => {
    const token = await guestJwt();
    return fetch(`${HOST}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Api-Token": API_TOKEN },
      cache: "no-store",
    });
  };
  let res = await call();
  if (res.status === 401) {
    await guestJwt(true);
    res = await call();
  }
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

/* ------------------------------ raw shapes ------------------------------ */

interface RawFixture {
  FixtureId: number;
  Competition: string;
  StartTime: number;
  Participant1: string;
  Participant2: string;
  Participant1Id: number;
  Participant2Id: number;
  Participant1IsHome: boolean;
}

interface RawOdds {
  Ts: number;
  InRunning?: boolean;
  Pct?: string[];
  SuperOddsType?: string;
}

interface PartTotals {
  Goals?: number;
  Corners?: number;
  YellowCards?: number;
  RedCards?: number;
}
/** Per-participant score with the real half-by-half breakdown TxLINE provides. */
interface PartScore {
  H1?: PartTotals;
  HT?: PartTotals;
  H2?: PartTotals;
  Total?: PartTotals;
}
interface RawTeamLineup {
  normativeId?: number;
  lineups?: { rosterNumber?: string; positionId?: number; starter?: boolean }[];
}
interface RawScore {
  Ts: number;
  Action?: string;
  Participant?: number; // 1 or 2
  Clock?: { Running: boolean; Seconds: number };
  Score?: { Participant1?: PartScore; Participant2?: PartScore };
  Data?: Record<string, unknown>;
  Lineups?: RawTeamLineup[];
}

interface RawValidation {
  summary?: {
    updateSubTreeRoot?: number[];
    updateStats?: { maxTimestamp?: number };
  };
  mainTreeProof?: unknown[];
  subTreeProof?: unknown[];
}

/* ------------------------------ mapping ------------------------------ */

function team(name: string, id: number) {
  const c = resolveCountry(name);
  return { id: String(id), name, code: c.code, flag: "", iso: c.iso };
}

function mapOdds(raw: RawOdds[] | null, updatedAt: string): { odds: Odds; inRunning: boolean } {
  const snap =
    raw?.find((o) => o.SuperOddsType === "1X2_PARTICIPANT_RESULT" && o.Pct?.length === 3) ?? raw?.[0];
  const pct = snap?.Pct?.map(Number);
  if (!pct || pct.length !== 3 || pct.some((p) => !p)) {
    return { odds: { home: 2.5, draw: 3.2, away: 2.8, updatedAt }, inRunning: false };
  }
  const dec = (p: number) => +(100 / p).toFixed(2);
  return {
    odds: { home: dec(pct[0]), draw: dec(pct[1]), away: dec(pct[2]), updatedAt },
    inRunning: Boolean(snap?.InRunning),
  };
}

/** Real win-probability history from the odds time-series (normalised %). */
function mapOddsHistory(raw: RawOdds[] | null): { t: number; home: number; draw: number; away: number }[] {
  const pts = (raw ?? [])
    .filter((o) => o.Pct?.length === 3)
    .map((o) => {
      const p = o.Pct!.map(Number);
      const total = p[0] + p[1] + p[2] || 1;
      return {
        t: o.Ts,
        home: +((p[0] / total) * 100).toFixed(1),
        draw: +((p[1] / total) * 100).toFixed(1),
        away: +((p[2] / total) * 100).toFixed(1),
      };
    })
    .sort((a, b) => a.t - b.t);
  // De-dupe identical consecutive points to keep the line clean.
  return pts.filter((p, i) => i === 0 || p.home !== pts[i - 1].home || p.away !== pts[i - 1].away);
}

/**
 * Real cumulative secondary stats (corners, cards) from Score.Total.
 *
 * These counters only ever increase, but any single snapshot may carry a
 * partial Total (e.g. `game_finalised` reports only Goals, so the last event
 * has Corners undefined). Taking the per-field **max** across the whole stream
 * yields the true cumulative figure regardless of which event last carried it.
 */
function mapLiveStats(scores: RawScore[] | null): { p1: PartTotals; p2: PartTotals } {
  const maxOf = (part: 1 | 2, pick: (t: PartTotals) => number | undefined) => {
    let m = 0;
    for (const s of scores ?? []) {
      const t = part === 1 ? s.Score?.Participant1?.Total : s.Score?.Participant2?.Total;
      const v = t ? pick(t) : undefined;
      if (typeof v === "number" && v > m) m = v;
    }
    return m;
  };
  const totals = (part: 1 | 2): PartTotals => ({
    Goals: maxOf(part, (t) => t.Goals),
    Corners: maxOf(part, (t) => t.Corners),
    YellowCards: maxOf(part, (t) => t.YellowCards),
    RedCards: maxOf(part, (t) => t.RedCards),
  });
  return { p1: totals(1), p2: totals(2) };
}

/** Derive status + minute from the score event stream. */
function mapStatus(scores: RawScore[] | null, startTime: number): { status: MatchStatus; minute: number | null } {
  if (!scores || scores.length === 0) {
    return { status: startTime > Date.now() ? "scheduled" : "scheduled", minute: null };
  }
  const actions = new Set(scores.map((s) => s.Action));
  const clock = [...scores].reverse().find((s) => s.Clock)?.Clock;

  if (actions.has("game_finalised")) return { status: "finished", minute: 90 };

  if (actions.has("kickoff")) {
    const secs = clock?.Seconds ?? 0;
    const running = clock?.Running ?? false;
    if (!running && actions.has("halftime_finalised") && secs <= 2760) {
      return { status: "halftime", minute: 45 };
    }
    return { status: "live", minute: Math.max(1, Math.min(90, Math.floor(secs / 60) + 1)) };
  }
  return { status: "scheduled", minute: null };
}

/**
 * Convert each score-stream event to a match minute.
 *
 * The TxLINE clock is unreliable at the edges: `halftime_finalised` and
 * `game_finalised` carry no clock, `clock_adjustment` resets it to 0, and a
 * thinned feed can momentarily drop it. We derive a **monotonic, carry-forward**
 * minute — the shown time never jumps backwards — and anchor the phase markers
 * (kickoff = 0, half-time = 45, full-time = 90). Returns minutes aligned to the
 * input order.
 */
function resolveMinutes(sorted: RawScore[]): number[] {
  let maxSecs = 0;
  let sawHalftime = false;
  return sorted.map((s) => {
    const act = (s.Action ?? "").toLowerCase();
    const secs = s.Clock?.Seconds;
    if (typeof secs === "number" && secs > 0) maxSecs = Math.max(maxSecs, secs);
    if (act === "halftime_finalised") {
      sawHalftime = true;
      return 45;
    }
    if (act === "game_finalised") return 90;
    // Opening kickoff only (clock still ~0); restart kickoffs get a real minute.
    if (act === "kickoff" && !sawHalftime && (secs ?? 0) < 60) return 0;
    const eff = typeof secs === "number" && secs > 0 ? secs : maxSecs;
    return Math.max(1, Math.min(90, Math.floor(eff / 60) + 1));
  });
}

/** Authoritative final goal total for a participant (last event that carries it). */
function finalGoals(list: RawScore[], part: 1 | 2): number | undefined {
  for (let i = list.length - 1; i >= 0; i--) {
    const g = part === 1 ? list[i].Score?.Participant1?.Total?.Goals : list[i].Score?.Participant2?.Total?.Goals;
    if (typeof g === "number") return g;
  }
  return undefined;
}

/**
 * Running goals (P1/P2) + reconstructed goal timeline.
 *
 * Intermediate snapshots carry provisional/noisy totals that dip and even swap
 * sides (VAR scratch values, `action_discarded`, thinned feed). Goals only ever
 * increase, so we accept a new total only when it exceeds the running max and
 * log the delta as goals at that event's real minute. We then reconcile to the
 * authoritative final score so the timeline count always matches the scoreboard.
 * Teams here are Participant1=home; `buildFixture` flips to real home/away.
 */
function mapScore(scores: RawScore[] | null): { p1: number; p2: number; events: MatchEvent[] } {
  const list = [...(scores ?? [])].sort((a, b) => (a.Ts ?? 0) - (b.Ts ?? 0));
  const minutes = resolveMinutes(list);
  let p1 = 0;
  let p2 = 0;
  let lastMinute = 1;
  const events: MatchEvent[] = [];

  list.forEach((s, i) => {
    const minute = minutes[i];
    if (minute > 0) lastMinute = minute;
    const g1 = s.Score?.Participant1?.Total?.Goals;
    const g2 = s.Score?.Participant2?.Total?.Goals;
    if (typeof g1 === "number" && g1 > p1) {
      for (let k = p1; k < g1; k++) events.push({ minute, type: "goal", team: "home" });
      p1 = g1;
    }
    if (typeof g2 === "number" && g2 > p2) {
      for (let k = p2; k < g2; k++) events.push({ minute, type: "goal", team: "away" });
      p2 = g2;
    }
  });

  // Reconcile to the authoritative final so markers == scoreboard even when the
  // thinned feed hid or over-counted a goal.
  const reconcile = (team: "home" | "away", target: number | undefined, current: number) => {
    if (target == null || target === current) return current;
    if (target > current) {
      // Missed goals (dropped by feed thinning): add at the last known minute.
      for (let k = current; k < target; k++) events.push({ minute: lastMinute, type: "goal", team });
    } else {
      // Over-counted (transient spike): drop the most-recent extras.
      let remove = current - target;
      for (let i = events.length - 1; i >= 0 && remove > 0; i--) {
        if (events[i].type === "goal" && events[i].team === team) {
          events.splice(i, 1);
          remove--;
        }
      }
    }
    return target;
  };
  p1 = reconcile("home", finalGoals(list, 1), p1);
  p2 = reconcile("away", finalGoals(list, 2), p2);

  events.sort((a, b) => a.minute - b.minute);
  return { p1, p2, events };
}

/** Decode the full live event stream into the rich LiveDetail (real data). */
function mapLiveDetail(
  scores: RawScore[] | null,
  p1Home: boolean,
  proofDepth: number | undefined,
): import("./types").LiveDetail | undefined {
  if (!scores || scores.length === 0) return undefined;

  // Which side is a Participant (1|2) on?
  const sideOf = (part?: number): "home" | "away" | undefined =>
    part == null ? undefined : (part === 1) === p1Home ? "home" : "away";

  const ACTION_KIND: Record<string, import("./types").FeedKind> = {
    goal: "goal",
    shot: "shot",
    corner: "corner",
    yellow_card: "yellow",
    red_card: "red",
    substitution: "sub",
    free_kick: "freekick",
    penalty: "penalty",
    penalty_outcome: "penalty",
    var: "var",
    var_end: "var",
    injury: "injury",
    kickoff: "kickoff",
    halftime_finalised: "halftime",
    game_finalised: "fulltime",
  };

  const sortedScores = [...(scores ?? [])].sort((a, b) => (a.Ts ?? 0) - (b.Ts ?? 0));
  const minutes = resolveMinutes(sortedScores);

  const events: import("./types").FeedEvent[] = [];
  let shotHome = 0,
    shotAway = 0,
    onTHome = 0,
    onTAway = 0,
    fkHome = 0,
    fkAway = 0,
    redHome = 0,
    redAway = 0;
  const subs: import("./types").LiveDetail["subs"] = [];
  const onTargetOutcomes = new Set(["Goal", "Saved", "GoalDisallowed"]);

  // Possession/danger from real TxLINE possession events. The feed is a thinned
  // sample and often one-sided within a single snapshot, so we **count** events
  // per side over the whole (accumulated) stream rather than time-weighting a
  // sparse window — then fall back to a shots/corners/goals proxy when the
  // sample is too thin to be trustworthy (never 0/100).
  let posHomeN = 0,
    posAwayN = 0,
    dangerHomeN = 0,
    dangerAwayN = 0;

  const isPossession = (a: string) => a === "possession" || a.endsWith("_possession") || a.endsWith("-possession");
  const isDanger = (a: string) => a.includes("danger") || a.includes("attack");

  for (let i = 0; i < sortedScores.length; i++) {
    const s = sortedScores[i];
    const rawAct = s.Action ?? "";
    const act = rawAct.toLowerCase();
    const side = sideOf(s.Participant);
    const min = minutes[i];

    if (isPossession(act)) {
      if (side === "home") posHomeN++;
      else if (side === "away") posAwayN++;
      if (isDanger(act)) {
        if (side === "home") dangerHomeN++;
        else if (side === "away") dangerAwayN++;
      }
      continue;
    }
    if (act === "shot") {
      const outcome = (s.Data?.Outcome as string) ?? "";
      const onT = onTargetOutcomes.has(outcome);
      if (side === "home") { shotHome++; if (onT) onTHome++; }
      else if (side === "away") { shotAway++; if (onT) onTAway++; }
      events.push({ minute: min, kind: "shot", team: side, detail: outcome });
      continue;
    }
    if (act === "free_kick") {
      if (side === "home") fkHome++;
      else if (side === "away") fkAway++;
      continue;
    }
    if (act === "red_card") {
      if (side === "home") redHome++;
      else if (side === "away") redAway++;
    }
    if (act === "substitution") {
      subs.push({
        minute: min,
        team: side ?? "home",
        inId: Number(s.Data?.PlayerInId ?? 0),
        outId: Number(s.Data?.PlayerOutId ?? 0),
      });
    }

    const kind = ACTION_KIND[act];
    if (kind && kind !== "shot") {
      // Drop restart kickoffs (after every goal / 2nd-half) — only the opening
      // whistle is a meaningful feed marker.
      if (kind === "kickoff" && min > 3) continue;
      const detail =
        act === "free_kick"
          ? (s.Data?.FreeKickType as string)
          : act === "injury"
            ? (s.Data?.Outcome as string)
            : undefined;
      events.push({ minute: kind === "kickoff" ? 0 : min, kind, team: side, detail });
    }
  }

  // Cumulative goals/corners for the possession proxy (per-field max, robust).
  const maxTotal = (part: 1 | 2, pick: (t: PartTotals) => number | undefined) => {
    let m = 0;
    for (const s of sortedScores) {
      const t = part === 1 ? s.Score?.Participant1?.Total : s.Score?.Participant2?.Total;
      const v = t ? pick(t) : undefined;
      if (typeof v === "number" && v > m) m = v;
    }
    return m;
  };
  const homeGoals = maxTotal(p1Home ? 1 : 2, (t) => t.Goals);
  const awayGoals = maxTotal(p1Home ? 2 : 1, (t) => t.Goals);
  const homeCorners = maxTotal(p1Home ? 1 : 2, (t) => t.Corners);
  const awayCorners = maxTotal(p1Home ? 2 : 1, (t) => t.Corners);

  const clamp = (n: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, n)));

  // Possession: use real event counts when the sample is two-sided and big
  // enough; otherwise derive a believable split from attacking output.
  const posTotalN = posHomeN + posAwayN;
  let possessionHome: number;
  if (posTotalN >= 6 && posHomeN > 0 && posAwayN > 0) {
    possessionHome = clamp((posHomeN / posTotalN) * 100, 5, 95);
  } else {
    const homeInf = shotHome * 2 + onTHome * 1.5 + homeCorners * 1.2 + homeGoals * 2 + 8;
    const awayInf = shotAway * 2 + onTAway * 1.5 + awayCorners * 1.2 + awayGoals * 2 + 8;
    possessionHome = clamp((homeInf / (homeInf + awayInf)) * 100, 32, 68);
  }
  const possessionAway = 100 - possessionHome;

  // Danger share: real counts when available, else from shots on target + goals.
  const dangerTotalN = dangerHomeN + dangerAwayN;
  let dangerHome: number;
  if (dangerTotalN >= 4 && dangerHomeN > 0 && dangerAwayN > 0) {
    dangerHome = clamp((dangerHomeN / dangerTotalN) * 100, 5, 95);
  } else {
    const h = onTHome + homeGoals + 0.3;
    const a = onTAway + awayGoals + 0.3;
    dangerHome = clamp((h / (h + a)) * 100, 20, 80);
  }

  // lineups (real shirt numbers + positions) — starters from the first payload.
  const firstLuEvent = sortedScores.find((s) => s.Lineups && s.Lineups.length >= 2);
  let lineup: import("./types").LiveDetail["lineup"];
  if (firstLuEvent?.Lineups && firstLuEvent.Lineups.length >= 2) {
    const toPlayers = (t: RawTeamLineup) =>
      (t.lineups ?? [])
        .filter((p) => p.starter)
        .map((p) => ({ number: Number(p.rosterNumber ?? 0), positionId: p.positionId ?? 0, starter: true }));
    const l1 = toPlayers(firstLuEvent.Lineups[0]);
    const l2 = toPlayers(firstLuEvent.Lineups[1]);
    if (l1.length && l2.length) {
      lineup = p1Home ? { home: l1, away: l2 } : { home: l2, away: l1 };
    }
  }

  // meta
  const metaVal = (a: string, key: string) => {
    const e = sortedScores.find((s) => s.Action === a);
    const v = e?.Data?.[key];
    return Array.isArray(v) ? v.join(", ") : (v as string | undefined);
  };

  return {
    events: events.sort((a, b) => a.minute - b.minute),
    possession: { home: possessionHome, away: possessionAway },
    danger: { home: dangerHome, away: 100 - dangerHome },
    shots: { home: shotHome, away: shotAway, onTargetHome: onTHome, onTargetAway: onTAway },
    freeKicks: { home: fkHome, away: fkAway },
    subs,
    redCards: { home: redHome, away: redAway },
    lineup,
    meta: { weather: metaVal("weather", "Conditions"), pitch: metaVal("pitch", "Conditions"), venue: metaVal("venue", "Type") },
    proofDepth,
    source: "txline",
  };
}

/* ------------------------------ verification (real on-chain proof) ------------------------------ */

const verifCache = new Map<string, { at: number; v: Fixture["verification"]; depth?: number }>();

async function fetchVerification(
  fixtureId: number,
): Promise<{ v: Fixture["verification"]; depth?: number }> {
  const key = String(fixtureId);
  const cached = verifCache.get(key);
  if (cached && Date.now() - cached.at < 5 * 60_000) return { v: cached.v, depth: cached.depth };
  try {
    const val = await apiGet<RawValidation>(`/api/fixtures/validation?fixtureId=${fixtureId}`);
    const rootBytes = val.summary?.updateSubTreeRoot;
    const depth = (val.mainTreeProof?.length ?? 0) + (val.subTreeProof?.length ?? 0) || undefined;
    if (!rootBytes?.length) return { v: undefined, depth };
    const merkleRoot =
      "0x" + rootBytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    const v: Fixture["verification"] = {
      signature: PROGRAM_ID, // interpreted as an account when explorerUrl is set
      merkleRoot,
      publishedAt: Math.floor((val.summary?.updateStats?.maxTimestamp ?? Date.now()) / 1000),
      cluster: CLUSTER,
      explorerUrl: `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${CLUSTER}`,
      proofDepth: depth,
    };
    verifCache.set(key, { at: Date.now(), v, depth });
    return { v, depth };
  } catch {
    return { v: undefined, depth: undefined };
  }
}

/* ------------------------------ build + cache ------------------------------ */

let cache: { at: number; fixtures: Fixture[]; ttl: number } | null = null;
// Last successfully-loaded fixtures — served if a later refresh transiently
// fails, so the board never blanks mid-demo on a network blip.
let lastGood: Fixture[] | null = null;

/**
 * Per-fixture accumulation of raw score events.
 *
 * `/api/scores/snapshot` returns a **thinned, sliding** view of the stream, so
 * rebuilding purely from the latest snapshot each poll makes a live match
 * "forget" everything before the current window — possession resets, the
 * timeline loses goals, stats jump. We instead merge every poll's events into a
 * persistent per-fixture log keyed by `Ts|Action|Participant`, so the picture
 * only ever grows and stays monotonic across the match.
 */
const scoreHistory = new Map<string, Map<string, RawScore>>();

function mergeScoreHistory(fixtureId: number, incoming: RawScore[] | null): RawScore[] {
  const key = String(fixtureId);
  let store = scoreHistory.get(key);
  if (!store) {
    store = new Map();
    scoreHistory.set(key, store);
  }
  for (const s of incoming ?? []) {
    const k = `${s.Ts}|${s.Action ?? ""}|${s.Participant ?? ""}`;
    const prev = store.get(k);
    // Keep the richest copy — a later poll may fill in Score/Clock/Data.
    if (!prev || (!prev.Score && s.Score) || (!prev.Clock && s.Clock) || (!prev.Data && s.Data)) {
      store.set(k, s);
    }
  }
  // Bound memory: keep the most recent events if a fixture's log grows huge.
  if (store.size > 4000) {
    const trimmed = [...store.entries()].sort((a, b) => (a[1].Ts ?? 0) - (b[1].Ts ?? 0)).slice(-3000);
    store = new Map(trimmed);
    scoreHistory.set(key, store);
  }
  return [...store.values()];
}

/* ------------------------------ hybrid enrichment ------------------------------ */
/**
 * The TxLINE snapshot for a **finished** synthetic fixture only records Goals
 * and Corners cumulatively (with a real half-by-half split); shots, free kicks,
 * possession and individual goal minutes were never in the feed. To make those
 * cards look complete we synthesize the missing pieces **deterministically and
 * anchored to the real data** — goals fall in their true half, shot/possession
 * numbers stay consistent with the real scoreline, and everything is seeded by
 * fixture id so it's stable across reloads. Live matches never use this — their
 * real per-minute detail is captured by the accumulation store as they stream.
 */

interface HalfSplit {
  h1Goals: number;
  h2Goals: number;
  totalGoals: number;
}

/** Real half-by-half goal split from the TxLINE Score object (per-field max). */
function realGoalSplit(scores: RawScore[], part: 1 | 2): HalfSplit {
  const g = (period: "H1" | "H2" | "Total") => {
    let m = 0;
    for (const s of scores) {
      const ps = part === 1 ? s.Score?.Participant1 : s.Score?.Participant2;
      const v = ps?.[period]?.Goals;
      if (typeof v === "number" && v > m) m = v;
    }
    return m;
  };
  const h1Goals = g("H1");
  const totalGoals = Math.max(g("Total"), h1Goals + g("H2"));
  // Reconcile: any goals not attributed to H1 belong to H2.
  const h2Goals = Math.max(g("H2"), totalGoals - h1Goals);
  return { h1Goals, h2Goals, totalGoals };
}

/** Spread `count` distinct goal minutes across (from, to], deterministic. */
function spreadMinutes(count: number, from: number, to: number, seed: number): number[] {
  const out = new Set<number>();
  const span = Math.max(1, to - from);
  for (let i = 0; out.size < count && i < count * 40; i++) {
    const m = from + 1 + Math.floor(seededRandom(seed + i * 137) * span);
    out.add(Math.max(from + 1, Math.min(to, m)));
  }
  return [...out].sort((a, b) => a - b);
}

/**
 * Rich, score-consistent match stats for a finished fixture. Keeps the
 * broadcast-graphic look (shots ≥ goals, possession tilts toward the chaser)
 * while staying tied to the real score. Fallback only — used when neither ESPN
 * nor API-Football can resolve the game (e.g. an out-of-window friendly).
 */
function synthMatchStats(seed: number, homeGoals: number, awayGoals: number) {
  const clamp = (n: number, lo: number, hi: number) => Math.round(Math.max(lo, Math.min(hi, n)));
  const possHome = clamp(44 + seededRandom(seed) * 12 + (awayGoals - homeGoals) * 2.5, 33, 67);
  const shotsHome = Math.max(homeGoals + 3, Math.round(9 + seededRandom(seed + 1) * 9));
  const shotsAway = Math.max(awayGoals + 3, Math.round(9 + seededRandom(seed + 2) * 9));
  const onTHome = Math.max(homeGoals, Math.round(shotsHome * (0.32 + seededRandom(seed + 3) * 0.18)));
  const onTAway = Math.max(awayGoals, Math.round(shotsAway * (0.32 + seededRandom(seed + 4) * 0.18)));
  const fkHome = Math.round(8 + seededRandom(seed + 5) * 8);
  const fkAway = Math.round(8 + seededRandom(seed + 6) * 8);
  return { possHome, shotsHome, shotsAway, onTHome, onTAway, fkHome, fkAway };
}

/* ------------------------------ API-Football detail ------------------------------ */
/**
 * Shape API-Football's real match detail into MatchPulse's own model. This is
 * the authoritative detail layer for any fixture that can be matched: real goal
 * minutes + scorers, shots, fouls, possession, cards, substitutions and full
 * lineups with player photos — exactly what TxLINE's thinned feed can't provide.
 */

const AF_PHOTO = (id: number | string) => `https://media.api-sports.io/football/players/${id}.png`;
const afNorm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/** Parse an API-Football stat value ("54%", "9", null) to a number. */
function statNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

interface ShapedDetail {
  events: MatchEvent[];
  live: LiveDetail;
  corners: [number, number];
  yellowCards: [number, number];
}

function buildLineups(
  apiLineups: any[],
  sideOf: (name: string) => "home" | "away" | undefined,
): { home: LineupPlayer[]; away: LineupPlayer[] } | undefined {
  if (!apiLineups || apiLineups.length < 2) return undefined;
  const toPlayers = (team: any): LineupPlayer[] =>
    (team?.startXI ?? []).map((slot: any) => {
      const p = slot.player ?? {};
      const grid = typeof p.grid === "string" ? p.grid.split(":") : [];
      return {
        number: Number(p.number ?? 0),
        positionId: 0,
        starter: true,
        name: p.name,
        photo: p.id ? AF_PHOTO(p.id) : undefined,
        pos: p.pos,
        gridY: grid.length === 2 ? Number(grid[0]) : undefined, // row (1 = GK)
        gridX: grid.length === 2 ? Number(grid[1]) : undefined, // slot within row
      };
    });
  const home = apiLineups.find((t) => sideOf(t?.team?.name ?? "") === "home") ?? apiLineups[0];
  const away = apiLineups.find((t) => sideOf(t?.team?.name ?? "") === "away") ?? apiLineups[1];
  const h = toPlayers(home);
  const a = toPlayers(away);
  if (!h.length || !a.length) return undefined;
  return { home: h, away: a };
}

function shapeApiFootball(
  detail: ApiFootballDetail,
  homeName: string,
  awayName: string,
  baseLive: LiveDetail | undefined,
  proofDepth: number | undefined,
  status: MatchStatus,
): ShapedDetail {
  const hN = afNorm(homeName);
  const aN = afNorm(awayName);
  const sideOf = (teamName: string): "home" | "away" | undefined => {
    const t = afNorm(teamName);
    if (!t) return undefined;
    if (t.includes(hN) || hN.includes(t)) return "home";
    if (t.includes(aN) || aN.includes(t)) return "away";
    return undefined;
  };
  // 45+2 -> 47 etc.; keeps chronological order (timeline/feed clamp as needed).
  const minuteOf = (e: any): number => Math.max(0, Number(e?.time?.elapsed ?? 0) + (Number(e?.time?.extra ?? 0) || 0));

  const evs = [...(detail.events ?? [])].sort((a, b) => minuteOf(a) - minuteOf(b));
  const timeline: MatchEvent[] = [];
  const feed: FeedEvent[] = [];
  let yH = 0;
  let yA = 0;
  let rH = 0;
  let rA = 0;

  for (const e of evs) {
    const side = sideOf(e?.team?.name ?? "");
    const min = minuteOf(e);
    const type = String(e?.type ?? "").toLowerCase();
    const dtl = String(e?.detail ?? "");
    const player = e?.player?.name as string | undefined;
    const assist = e?.assist?.name as string | undefined;

    if (type === "goal") {
      const own = /own goal/i.test(dtl);
      const pen = /penalty/i.test(dtl);
      timeline.push({ minute: min, type: "goal", team: side, player });
      feed.push({
        minute: min,
        kind: pen ? "penalty" : "goal",
        team: side,
        detail: [player, own ? "OG" : "", assist ? `assist ${assist}` : ""].filter(Boolean).join(" · ") || undefined,
      });
    } else if (type === "card") {
      const red = /red/i.test(dtl);
      if (side === "home") red ? rH++ : yH++;
      else if (side === "away") red ? rA++ : yA++;
      timeline.push({ minute: min, type: red ? "red" : "yellow", team: side, player });
      feed.push({ minute: min, kind: red ? "red" : "yellow", team: side, detail: player });
    } else if (type === "subst") {
      // API-Football lists `player` = coming on, `assist` = going off.
      feed.push({ minute: min, kind: "sub", team: side, detail: [player, assist].filter(Boolean).join(" ⇄ ") || undefined });
    } else if (type === "var") {
      feed.push({ minute: min, kind: "var", team: side, detail: dtl || undefined });
    }
  }

  // Broadcast-style timeline markers.
  const markers: FeedEvent[] = [{ minute: 0, kind: "kickoff" }];
  const hadSecondHalf = status === "finished" || evs.some((e) => minuteOf(e) > 45);
  if (hadSecondHalf) markers.push({ minute: 45, kind: "halftime" });
  if (status === "finished") markers.push({ minute: 90, kind: "fulltime" });
  const feedAll = [...markers, ...feed].sort((a, b) => a.minute - b.minute);

  // ---- per-team statistics ----
  const statFor = (side: "home" | "away") => {
    const entry = (detail.statistics ?? []).find((s: any) => sideOf(s?.team?.name ?? "") === side);
    const map = new Map<string, unknown>();
    for (const s of entry?.statistics ?? []) map.set(String(s.type).toLowerCase(), s.value);
    return (label: string) => statNum(map.get(label.toLowerCase()));
  };
  const sh = statFor("home");
  const sa = statFor("away");

  const pH = sh("Ball Possession");
  const pA = sa("Ball Possession");
  const possHome = pH || pA ? Math.round((pH / ((pH + pA) || 100)) * 100) : baseLive?.possession.home ?? 50;
  const xgH = sh("expected_goals");
  const xgA = sa("expected_goals");
  const dangerHome = xgH + xgA > 0 ? Math.round((xgH / (xgH + xgA)) * 100) : possHome;

  const live: LiveDetail = {
    events: feedAll,
    possession: { home: possHome, away: 100 - possHome },
    danger: { home: dangerHome, away: 100 - dangerHome },
    shots: {
      home: sh("Total Shots"),
      away: sa("Total Shots"),
      onTargetHome: sh("Shots on Goal"),
      onTargetAway: sa("Shots on Goal"),
    },
    freeKicks: { home: sh("Fouls"), away: sa("Fouls") },
    subs: [],
    redCards: { home: rH, away: rA },
    lineup: buildLineups(detail.lineups, sideOf),
    meta: baseLive?.meta ?? {},
    proofDepth,
    source: "api-football",
  };

  return {
    events: timeline.sort((a, b) => a.minute - b.minute),
    live,
    corners: [sh("Corner Kicks"), sa("Corner Kicks")],
    yellowCards: [yH, yA],
  };
}
async function buildFixture(raw: RawFixture): Promise<Fixture> {
  const nowIso = new Date().toISOString();
  // Scores carry the richest data — retry once on a transient failure.
  const getScores = () =>
    apiGet<RawScore[]>(`/api/scores/snapshot/${raw.FixtureId}`).catch(async () => {
      await new Promise((r) => setTimeout(r, 200));
      return apiGet<RawScore[]>(`/api/scores/snapshot/${raw.FixtureId}`).catch(() => null);
    });
  const [odds, freshScores, verif] = await Promise.all([
    apiGet<RawOdds[]>(`/api/odds/snapshot/${raw.FixtureId}`).catch(() => null),
    getScores(),
    fetchVerification(raw.FixtureId),
  ]);
  const verification = verif.v;
  // Accumulate across polls so the reconstruction never resets from zero.
  const scores = mergeScoreHistory(raw.FixtureId, freshScores);

  const { odds: mappedOdds } = mapOdds(odds, nowIso);
  const { status, minute } = mapStatus(scores, raw.StartTime);
  const { p1, p2, events: rawEvents } = mapScore(scores);
  const oddsHistoryRaw = mapOddsHistory(odds);
  const stats = mapLiveStats(scores);

  // Participant1/2 -> home/away.
  const p1Home = raw.Participant1IsHome;
  let live = status !== "scheduled" ? mapLiveDetail(scores, p1Home, verif.depth) : undefined;
  const home = p1Home ? raw.Participant1 : raw.Participant2;
  const homeId = p1Home ? raw.Participant1Id : raw.Participant2Id;
  const away = p1Home ? raw.Participant2 : raw.Participant1;
  const awayId = p1Home ? raw.Participant2Id : raw.Participant1Id;
  const homeScore = p1Home ? p1 : p2;
  const awayScore = p1Home ? p2 : p1;

  // Odds history is participant1=home aligned already (home is p1's implied);
  // if p2 is home, swap home/away probabilities.
  const oddsHistory =
    oddsHistoryRaw.length >= 3
      ? p1Home
        ? oddsHistoryRaw
        : oddsHistoryRaw.map((o) => ({ t: o.t, home: o.away, draw: o.draw, away: o.home }))
      : undefined;

  const cornersP = [stats.p1.Corners ?? 0, stats.p2.Corners ?? 0] as const;
  const cardsP = [stats.p1.YellowCards ?? 0, stats.p2.YellowCards ?? 0] as const;
  let liveStats =
    status !== "scheduled"
      ? {
          corners: (p1Home ? [cornersP[0], cornersP[1]] : [cornersP[1], cornersP[0]]) as [number, number],
          yellowCards: (p1Home ? [cardsP[0], cardsP[1]] : [cardsP[1], cardsP[0]]) as [number, number],
        }
      : undefined;
  let events: MatchEvent[] =
    status === "scheduled"
      ? []
      : rawEvents.map((e) => ({
          ...e,
          team: raw.Participant1IsHome ? e.team : (e.team === "home" ? "away" : "home"),
        }));

  // ── Rich match detail: ESPN is the authoritative layer, API-Football a
  // fallback. Real goal scorers + assists + minutes, full lineups with
  // formations, and per-team stats — for any fixture we can resolve. TxLINE
  // stays the source for the live score, odds and Solana verification. Both
  // sources are cached per-endpoint so we stay polite / within budget.
  let enriched = false;
  const applyDetail = (shaped: ShapedDetail) => {
    if (shaped.events.length) events = shaped.events;
    live = shaped.live;
    // Prefer the detail source's corners/yellows; fall back to TxLINE's real
    // cumulative totals if stats haven't been published yet (early live).
    const cornersReal = shaped.corners[0] || shaped.corners[1];
    const yellowReal = shaped.yellowCards[0] || shaped.yellowCards[1];
    liveStats = {
      corners: cornersReal ? shaped.corners : liveStats?.corners ?? [0, 0],
      yellowCards: yellowReal ? shaped.yellowCards : liveStats?.yellowCards ?? [0, 0],
    };
    enriched = true;
  };

  if (status !== "scheduled") {
    const dateIso = new Date(raw.StartTime).toISOString().split("T")[0];
    const isLive = status === "live" || status === "halftime";

    // 1) ESPN — real detail for the (real) 2026 World Cup fixtures TxLINE mirrors.
    try {
      const espn = await getEspnDetail(dateIso, home, away, { live: isLive, status, proofDepth: verif.depth, baseLive: live });
      if (espn && (espn.events.length || espn.live.lineup || espn.live.shots.home || espn.live.shots.away || espn.corners[0] || espn.corners[1])) {
        applyDetail(espn);
      }
    } catch (e) {
      console.error("ESPN enrichment failed:", e);
    }

    // 2) API-Football — fallback only when ESPN couldn't resolve the game.
    if (!enriched) {
      try {
        const detail = await getApiFootballDetail(dateIso, home, away, { live: isLive });
        if (detail && (detail.events.length || detail.statistics.length || detail.lineups.length)) {
          applyDetail(shapeApiFootball(detail, home, away, live, verif.depth, status));
        }
      } catch (e) {
        console.error("API-Football enrichment failed:", e);
      }
    }
  }


  // Fallback only: a finished fixture we couldn't match to API-Football (e.g. an
  // out-of-window friendly). TxLINE records just Goals+Corners with a real
  // half-split, so synthesize the rest deterministically, anchored to the real
  // score, so the card isn't blank. Never runs when real detail is available.
  if (!enriched && status === "finished") {
    const seed = fnv1a(`synth-${raw.FixtureId}`);
    const homeSplit = realGoalSplit(scores, p1Home ? 1 : 2);
    const awaySplit = realGoalSplit(scores, p1Home ? 2 : 1);
    // Distribute each side's goals within the halves they actually scored in.
    const homeMins = [
      ...spreadMinutes(Math.min(homeSplit.h1Goals, homeScore), 0, 45, seed + 11),
      ...spreadMinutes(Math.max(0, homeScore - homeSplit.h1Goals), 45, 90, seed + 12),
    ];
    const awayMins = [
      ...spreadMinutes(Math.min(awaySplit.h1Goals, awayScore), 0, 45, seed + 21),
      ...spreadMinutes(Math.max(0, awayScore - awaySplit.h1Goals), 45, 90, seed + 22),
    ];
    events = [
      ...homeMins.map((m) => ({ minute: m, type: "goal" as const, team: "home" as const })),
      ...awayMins.map((m) => ({ minute: m, type: "goal" as const, team: "away" as const })),
    ].sort((a, b) => a.minute - b.minute);

    const st = synthMatchStats(seed, homeScore, awayScore);
    const goalFeed = [
      ...homeMins.map((m) => ({ minute: m, kind: "goal" as const, team: "home" as const })),
      ...awayMins.map((m) => ({ minute: m, kind: "goal" as const, team: "away" as const })),
    ];
    // Keep any real non-goal feed events; overlay synthesized goals + stats.
    const realFeed = (live?.events ?? []).filter((e) => e.kind !== "goal");
    live = {
      events: [...realFeed, ...goalFeed].sort((a, b) => a.minute - b.minute),
      possession: { home: st.possHome, away: 100 - st.possHome },
      danger: live?.danger ?? { home: st.possHome, away: 100 - st.possHome },
      shots: { home: st.shotsHome, away: st.shotsAway, onTargetHome: st.onTHome, onTargetAway: st.onTAway },
      freeKicks: { home: st.fkHome, away: st.fkAway },
      subs: live?.subs ?? [],
      redCards: live?.redCards ?? { home: 0, away: 0 },
      lineup: live?.lineup,
      meta: live?.meta ?? {},
      proofDepth: verif.depth,
      source: "synth",
    };
  }

  const built: Fixture = {
    id: String(raw.FixtureId),
    stage: raw.Competition,
    venue: "",
    kickoff: new Date(raw.StartTime).toISOString(),
    status,
    minute,
    home: team(home, homeId),
    away: team(away, awayId),
    homeScore,
    awayScore,
    odds: mappedOdds,
    events,
    oddsHistory,
    liveStats,
    live,
    verification,
  };

  return built;
}

function cacheTtlFor(fixtures: Fixture[]): number {
  return fixtures.some((f) => f.status === "live" || f.status === "halftime") ? LIVE_CACHE_TTL : STATIC_CACHE_TTL;
}

async function loadAll(): Promise<Fixture[]> {
  if (cache && Date.now() - cache.at < cache.ttl) return cache.fixtures;

  // Warm the JWT once before the fan-out so the day requests reuse it.
  try {
    await guestJwt();
  } catch {
    /* apiGet retries auth per-call; fall through */
  }

  // Fixture window (in epoch-days). We look back far enough to keep the board
  // populated once a tournament's live window closes: TxLINE retains finished
  // matches' full score/event history, so rather than showing an empty "today"
  // we surface the most recent completed fixtures (e.g. the knockout stage) plus
  // anything live or upcoming. Tunable via TXLINE_LOOKBACK_DAYS (default 16).
  const today = Math.floor(Date.now() / 86_400_000);
  const lookback = Math.max(1, Number(process.env.TXLINE_LOOKBACK_DAYS) || 16);
  const days: number[] = [];
  for (let d = today - lookback; d <= today + 1; d++) days.push(d);

  const rawMap = new Map<number, RawFixture>();
  await Promise.all(
    COMPETITIONS.flatMap((comp) =>
      days.map(async (d) => {
        try {
          const list = await apiGet<RawFixture[]>(
            `/api/fixtures/snapshot?competitionId=${comp}&startEpochDay=${d}`,
          );
          for (const f of list) if (!rawMap.has(f.FixtureId)) rawMap.set(f.FixtureId, f);
        } catch {
          /* skip */
        }
      }),
    ),
  );

  // Every fixtures/snapshot call failed (auth/network blip). Don't cache an
  // empty result over good data — serve last-good and retry again in 3s.
  if (rawMap.size === 0) {
    const fallback = lastGood ?? [];
    cache = { at: Date.now(), fixtures: fallback, ttl: 3_000 };
    return fallback;
  }

  const fixtures = await Promise.all([...rawMap.values()].map(buildFixture));
  const rank: Record<MatchStatus, number> = { live: 0, halftime: 0, scheduled: 1, finished: 2, postponed: 3 };
  fixtures.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.status === "finished" ? +new Date(b.kickoff) - +new Date(a.kickoff) : +new Date(a.kickoff) - +new Date(b.kickoff)),
  );

  lastGood = fixtures;
  cache = { at: Date.now(), fixtures, ttl: cacheTtlFor(fixtures) };
  return fixtures;
}

/* ------------------------------ client ------------------------------ */

export class LiveTxLineClient implements TxLineClient {
  readonly source = "live" as const;

  async getFixtures(status?: MatchStatus): Promise<Fixture[]> {
    const all = await loadAll();
    return status ? all.filter((f) => f.status === status) : all;
  }

  async getFixture(id: string): Promise<Fixture | null> {
    const all = await loadAll();
    return all.find((f) => f.id === id) ?? null;
  }

  async getResult(id: string): Promise<MatchResult | null> {
    const f = await this.getFixture(id);
    if (!f || f.status !== "finished") return null;
    const outcome = f.homeScore > f.awayScore ? "home" : f.homeScore < f.awayScore ? "away" : "draw";
    return {
      fixtureId: f.id,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      outcome,
      totalGoals: f.homeScore + f.awayScore,
      finishedAt: f.kickoff,
      verification: f.verification,
    };
  }
}
