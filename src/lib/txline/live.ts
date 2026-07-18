import "server-only";
import type { Fixture, MatchEvent, MatchResult, MatchStatus, Odds, TxLineClient } from "./types";
import { resolveCountry } from "./countries";

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
const CACHE_TTL = 12_000;

/* ------------------------------ auth ------------------------------ */

let jwt = "";
let jwtAt = 0;

async function guestJwt(force = false): Promise<string> {
  if (!force && jwt && Date.now() - jwtAt < 10 * 60_000) return jwt;
  const res = await fetch(`${HOST}/auth/guest/start`, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`guest/start ${res.status}`);
  jwt = ((await res.json()) as { token: string }).token;
  jwtAt = Date.now();
  return jwt;
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
interface RawTeamLineup {
  normativeId?: number;
  lineups?: { rosterNumber?: string; positionId?: number; starter?: boolean }[];
}
interface RawScore {
  Ts: number;
  Action?: string;
  Participant?: number; // 1 or 2
  Clock?: { Running: boolean; Seconds: number };
  Score?: { Participant1?: { Total?: PartTotals }; Participant2?: { Total?: PartTotals } };
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

/** Real cumulative secondary stats (corners, yellow cards) from Score.Total. */
function mapLiveStats(scores: RawScore[] | null): { p1: PartTotals; p2: PartTotals } {
  const withTotal = [...(scores ?? [])].reverse().find((s) => s.Score?.Participant1?.Total || s.Score?.Participant2?.Total);
  return {
    p1: withTotal?.Score?.Participant1?.Total ?? {},
    p2: withTotal?.Score?.Participant2?.Total ?? {},
  };
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

/** Running goals (P1/P2) + reconstructed goal timeline from the event stream. */
function mapScore(scores: RawScore[] | null): { p1: number; p2: number; events: MatchEvent[] } {
  let p1 = 0;
  let p2 = 0;
  const events: MatchEvent[] = [];
  for (const s of scores ?? []) {
    const g1 = s.Score?.Participant1?.Total?.Goals;
    const g2 = s.Score?.Participant2?.Total?.Goals;
    const minute = Math.max(1, Math.min(90, Math.floor((s.Clock?.Seconds ?? 0) / 60) + 1));
    if (typeof g1 === "number" && g1 > p1) {
      for (let i = p1; i < g1; i++) events.push({ minute, type: "goal", team: "p1" as "home" });
      p1 = g1;
    }
    if (typeof g2 === "number" && g2 > p2) {
      for (let i = p2; i < g2; i++) events.push({ minute, type: "goal", team: "p2" as "away" });
      p2 = g2;
    }
  }
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
  const minuteOf = (s: RawScore) => Math.max(1, Math.min(90, Math.floor((s.Clock?.Seconds ?? 0) / 60) + 1));

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

  const events: import("./types").FeedEvent[] = [];
  let posHome = 0,
    posAway = 0,
    dangerHome = 0,
    dangerAway = 0;
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

  for (const s of scores) {
    const act = s.Action ?? "";
    const side = sideOf(s.Participant);
    const min = minuteOf(s);

    // possession / pressure
    if (act.endsWith("possession") || act === "possession") {
      if (side === "home") posHome++;
      else if (side === "away") posAway++;
      if (act === "danger_possession" || act === "high_danger_possession" || act === "attack_possession") {
        if (side === "home") dangerHome++;
        else if (side === "away") dangerAway++;
      }
      continue;
    }
    // shots
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
      const detail =
        act === "free_kick"
          ? (s.Data?.FreeKickType as string)
          : act === "injury"
            ? (s.Data?.Outcome as string)
            : undefined;
      events.push({ minute: act === "kickoff" ? 0 : min, kind, team: side, detail });
    }
  }

  const totalPos = posHome + posAway || 1;
  const totalDanger = dangerHome + dangerAway || 1;

  // lineups (real shirt numbers + positions)
  const luEvent = [...scores].reverse().find((s) => s.Lineups && s.Lineups.length >= 2);
  let lineup: import("./types").LiveDetail["lineup"];
  if (luEvent?.Lineups && luEvent.Lineups.length >= 2) {
    const toPlayers = (t: RawTeamLineup) =>
      (t.lineups ?? [])
        .filter((p) => p.starter)
        .map((p) => ({ number: Number(p.rosterNumber ?? 0), positionId: p.positionId ?? 0, starter: true }));
    const l1 = toPlayers(luEvent.Lineups[0]);
    const l2 = toPlayers(luEvent.Lineups[1]);
    if (l1.length && l2.length) lineup = p1Home ? { home: l1, away: l2 } : { home: l2, away: l1 };
  }

  // meta
  const metaVal = (a: string, key: string) => {
    const e = scores.find((s) => s.Action === a);
    const v = e?.Data?.[key];
    return Array.isArray(v) ? v.join(", ") : (v as string | undefined);
  };

  return {
    events: events.sort((a, b) => a.minute - b.minute),
    possession: { home: Math.round((posHome / totalPos) * 100), away: Math.round((posAway / totalPos) * 100) },
    danger: { home: Math.round((dangerHome / totalDanger) * 100), away: Math.round((dangerAway / totalDanger) * 100) },
    shots: { home: shotHome, away: shotAway, onTargetHome: onTHome, onTargetAway: onTAway },
    freeKicks: { home: fkHome, away: fkAway },
    subs,
    redCards: { home: redHome, away: redAway },
    lineup,
    meta: { weather: metaVal("weather", "Conditions"), pitch: metaVal("pitch", "Conditions"), venue: metaVal("venue", "Type") },
    proofDepth,
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

let cache: { at: number; fixtures: Fixture[] } | null = null;

async function buildFixture(raw: RawFixture): Promise<Fixture> {
  const nowIso = new Date().toISOString();
  // Scores carry the richest data — retry once on a transient failure.
  const getScores = () =>
    apiGet<RawScore[]>(`/api/scores/snapshot/${raw.FixtureId}`).catch(async () => {
      await new Promise((r) => setTimeout(r, 200));
      return apiGet<RawScore[]>(`/api/scores/snapshot/${raw.FixtureId}`).catch(() => null);
    });
  const [odds, scores, verif] = await Promise.all([
    apiGet<RawOdds[]>(`/api/odds/snapshot/${raw.FixtureId}`).catch(() => null),
    getScores(),
    fetchVerification(raw.FixtureId),
  ]);
  const verification = verif.v;

  const { odds: mappedOdds } = mapOdds(odds, nowIso);
  const { status, minute } = mapStatus(scores, raw.StartTime);
  const { p1, p2, events: rawEvents } = mapScore(scores);
  const oddsHistoryRaw = mapOddsHistory(odds);
  const stats = mapLiveStats(scores);

  // Participant1/2 -> home/away.
  const p1Home = raw.Participant1IsHome;
  const live = status !== "scheduled" ? mapLiveDetail(scores, p1Home, verif.depth) : undefined;
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
  const liveStats =
    status !== "scheduled"
      ? {
          corners: (p1Home ? [cornersP[0], cornersP[1]] : [cornersP[1], cornersP[0]]) as [number, number],
          yellowCards: (p1Home ? [cardsP[0], cardsP[1]] : [cardsP[1], cardsP[0]]) as [number, number],
        }
      : undefined;
  const events: MatchEvent[] =
    status === "scheduled"
      ? []
      : rawEvents.map((e) => ({
          ...e,
          team: (raw.Participant1IsHome ? e.team === "home" : e.team === "away") ? "home" : "away",
        }));

  return {
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
}

async function loadAll(): Promise<Fixture[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.fixtures;

  const today = Math.floor(Date.now() / 86_400_000);
  const days = [today - 4, today - 3, today - 2, today - 1, today, today + 1, today + 2, today + 3];

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

  const fixtures = await Promise.all([...rawMap.values()].map(buildFixture));
  const rank: Record<MatchStatus, number> = { live: 0, halftime: 0, scheduled: 1, finished: 2, postponed: 3 };
  fixtures.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.status === "finished" ? +new Date(b.kickoff) - +new Date(a.kickoff) : +new Date(a.kickoff) - +new Date(b.kickoff)),
  );

  cache = { at: Date.now(), fixtures };
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
