import "server-only";
import type { Fixture, MatchEvent, MatchResult, MatchStatus, Odds, TxLineClient } from "./types";
import { resolveCountry } from "./countries";

/**
 * Live TxLINE provider (server-side only).
 *
 * Data flow (see github.com/txodds/tx-on-chain and the hosted quickstart):
 *   POST /auth/guest/start                     -> short-lived guest JWT
 *   GET  /api/fixtures/snapshot?competitionId=  -> fixtures
 *   GET  /api/odds/snapshot/{fixtureId}         -> 1X2 de-margined prices (+ %)
 *   GET  /api/scores/snapshot/{fixtureId}       -> match state (GameState, Clock)
 * All data requests send `Authorization: Bearer <jwt>` + `X-Api-Token: <token>`.
 *
 * The on-chain subscription that mints the API token is done once, out of band
 * (scripts/txline-signup.mjs). This class just consumes the feed and maps it to
 * our {@link Fixture} shape, so the UI is identical to the mock provider.
 */

const HOST = process.env.TXLINE_HOST ?? "https://txline-dev.txodds.com";
const API_TOKEN = process.env.TXLINE_API_TOKEN ?? "";
// World Cup = 72, International Friendlies = 430.
const COMPETITIONS = (process.env.TXLINE_COMPETITIONS ?? "72,430").split(",").map((s) => s.trim());
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
  const doFetch = async () => {
    const token = await guestJwt();
    return fetch(`${HOST}${path}`, {
      headers: { Authorization: `Bearer ${token}`, "X-Api-Token": API_TOKEN },
      cache: "no-store",
    });
  };
  let res = await doFetch();
  if (res.status === 401) {
    await guestJwt(true); // refresh once
    res = await doFetch();
  }
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

/* ------------------------------ mapping ------------------------------ */

interface RawFixture {
  FixtureId: number;
  Competition: string;
  CompetitionId: number;
  StartTime: number;
  Participant1: string;
  Participant2: string;
  Participant1Id: number;
  Participant2Id: number;
  Participant1IsHome: boolean;
}

interface RawOdds {
  Ts: number;
  InRunning: boolean;
  PriceNames?: string[];
  Prices?: number[];
  Pct?: string[];
  SuperOddsType?: string;
}

interface RawScore {
  Ts: number;
  GameState?: string;
  Clock?: { Running: boolean; Seconds: number };
  Stats?: Record<string, unknown>;
  [k: string]: unknown;
}

function team(name: string, id: number) {
  const c = resolveCountry(name);
  return { id: String(id), name, code: c.code, flag: "", iso: c.iso };
}

/** Latest 1X2 snapshot -> decimal odds via implied percentages. */
function mapOdds(raw: RawOdds[] | null, updatedAt: string): { odds: Odds; inRunning: boolean } {
  const snap = raw?.find((o) => o.SuperOddsType === "1X2_PARTICIPANT_RESULT" && o.Pct?.length === 3) ?? raw?.[0];
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

function mapStatus(scores: RawScore[] | null, startTime: number, inRunning: boolean): { status: MatchStatus; minute: number | null } {
  const latest = scores?.[scores.length - 1];
  const gs = (latest?.GameState ?? "").toLowerCase();
  const now = Date.now();

  if (/finish|full.?time|\bft\b|ended|after.?extra|\bfo\b|abandon|cancel/.test(gs)) {
    return { status: "finished", minute: 90 };
  }
  if (/half.?time|\bht\b/.test(gs)) return { status: "halftime", minute: 45 };

  const clockSecs = latest?.Clock?.Seconds ?? 0;
  const live =
    inRunning ||
    (latest?.Clock?.Running ?? false) ||
    (gs !== "" && !/sched|not.?start|\bns\b|postpone/.test(gs) && startTime <= now);

  if (live) {
    const minute = clockSecs > 0 ? Math.min(90, Math.floor(clockSecs / 60) + 1) : startTime <= now ? 1 : null;
    return { status: "live", minute };
  }
  return { status: "scheduled", minute: null };
}

/** Best-effort scoreline + goal events from the score event stream. */
function mapScore(scores: RawScore[] | null): { home: number; away: number; events: MatchEvent[] } {
  let home = 0;
  let away = 0;
  const events: MatchEvent[] = [];
  for (const s of scores ?? []) {
    const st = s.Stats as Record<string, number> | undefined;
    // TxODDS soccer score keys land in Stats once a match is in-running; read the
    // participant totals when present (defensive: several possible key shapes).
    const h = num(st?.["1"]) ?? num((s as Record<string, unknown>).Participant1Score);
    const a = num(st?.["2"]) ?? num((s as Record<string, unknown>).Participant2Score);
    if (h !== null && a !== null) {
      if (h > home) events.push({ minute: minuteOf(s), type: "goal", team: "home" });
      if (a > away) events.push({ minute: minuteOf(s), type: "goal", team: "away" });
      home = h;
      away = a;
    }
  }
  return { home, away, events };
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function minuteOf(s: RawScore): number {
  const secs = s.Clock?.Seconds ?? 0;
  return Math.max(1, Math.min(90, Math.floor(secs / 60) + 1));
}

/* ------------------------------ client ------------------------------ */

let cache: { at: number; fixtures: Fixture[] } | null = null;

async function buildFixture(raw: RawFixture): Promise<Fixture> {
  const nowIso = new Date().toISOString();
  const [odds, scores] = await Promise.all([
    apiGet<RawOdds[]>(`/api/odds/snapshot/${raw.FixtureId}`).catch(() => null),
    apiGet<RawScore[]>(`/api/scores/snapshot/${raw.FixtureId}`).catch(() => null),
  ]);

  const { odds: mappedOdds, inRunning } = mapOdds(odds, nowIso);
  const { status, minute } = mapStatus(scores, raw.StartTime, inRunning);
  const { home: homeScore, away: awayScore, events } = mapScore(scores);

  const home = raw.Participant1IsHome ? raw.Participant1 : raw.Participant2;
  const homeId = raw.Participant1IsHome ? raw.Participant1Id : raw.Participant2Id;
  const away = raw.Participant1IsHome ? raw.Participant2 : raw.Participant1;
  const awayId = raw.Participant1IsHome ? raw.Participant2Id : raw.Participant1Id;
  // Score stats are keyed to participant 1/2; swap if participant 2 is home.
  const [hs, as] = raw.Participant1IsHome ? [homeScore, awayScore] : [awayScore, homeScore];

  return {
    id: String(raw.FixtureId),
    stage: raw.Competition,
    venue: "",
    kickoff: new Date(raw.StartTime).toISOString(),
    status,
    minute,
    home: team(home, homeId),
    away: team(away, awayId),
    homeScore: hs,
    awayScore: as,
    odds: mappedOdds,
    events: status === "scheduled" ? [] : events,
  };
}

async function loadAll(): Promise<Fixture[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.fixtures;

  const raws: RawFixture[] = [];
  for (const comp of COMPETITIONS) {
    try {
      const list = await apiGet<RawFixture[]>(`/api/fixtures/snapshot?competitionId=${comp}`);
      raws.push(...list);
    } catch {
      /* skip a competition that errors */
    }
  }
  // De-dupe by fixture id, then enrich with odds + scores in parallel.
  const seen = new Set<number>();
  const unique = raws.filter((r) => (seen.has(r.FixtureId) ? false : (seen.add(r.FixtureId), true)));
  const fixtures = await Promise.all(unique.map(buildFixture));

  const rank: Record<MatchStatus, number> = { live: 0, halftime: 0, scheduled: 1, finished: 2, postponed: 3 };
  fixtures.sort((a, b) => rank[a.status] - rank[b.status] || +new Date(a.kickoff) - +new Date(b.kickoff));

  cache = { at: Date.now(), fixtures };
  return fixtures;
}

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
    };
  }
}
