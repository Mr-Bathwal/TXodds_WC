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
}
interface RawScore {
  Ts: number;
  Action?: string;
  Clock?: { Running: boolean; Seconds: number };
  Score?: { Participant1?: { Total?: PartTotals }; Participant2?: { Total?: PartTotals } };
}

interface RawValidation {
  summary?: {
    updateSubTreeRoot?: number[];
    updateStats?: { maxTimestamp?: number };
  };
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

/* ------------------------------ verification (real on-chain proof) ------------------------------ */

const verifCache = new Map<string, { at: number; v: Fixture["verification"] }>();

async function fetchVerification(fixtureId: number): Promise<Fixture["verification"]> {
  const key = String(fixtureId);
  const cached = verifCache.get(key);
  if (cached && Date.now() - cached.at < 5 * 60_000) return cached.v;
  try {
    const val = await apiGet<RawValidation>(`/api/fixtures/validation?fixtureId=${fixtureId}`);
    const rootBytes = val.summary?.updateSubTreeRoot;
    if (!rootBytes?.length) return undefined;
    const merkleRoot =
      "0x" + rootBytes.map((b) => b.toString(16).padStart(2, "0")).join("");
    const v: Fixture["verification"] = {
      signature: PROGRAM_ID, // interpreted as an account when explorerUrl is set
      merkleRoot,
      publishedAt: Math.floor((val.summary?.updateStats?.maxTimestamp ?? Date.now()) / 1000),
      cluster: CLUSTER,
      explorerUrl: `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=${CLUSTER}`,
    };
    verifCache.set(key, { at: Date.now(), v });
    return v;
  } catch {
    return undefined;
  }
}

/* ------------------------------ build + cache ------------------------------ */

let cache: { at: number; fixtures: Fixture[] } | null = null;

async function buildFixture(raw: RawFixture): Promise<Fixture> {
  const nowIso = new Date().toISOString();
  const [odds, scores, verification] = await Promise.all([
    apiGet<RawOdds[]>(`/api/odds/snapshot/${raw.FixtureId}`).catch(() => null),
    apiGet<RawScore[]>(`/api/scores/snapshot/${raw.FixtureId}`).catch(() => null),
    fetchVerification(raw.FixtureId),
  ]);

  const { odds: mappedOdds } = mapOdds(odds, nowIso);
  const { status, minute } = mapStatus(scores, raw.StartTime);
  const { p1, p2, events: rawEvents } = mapScore(scores);

  // Participant1/2 -> home/away.
  const home = raw.Participant1IsHome ? raw.Participant1 : raw.Participant2;
  const homeId = raw.Participant1IsHome ? raw.Participant1Id : raw.Participant2Id;
  const away = raw.Participant1IsHome ? raw.Participant2 : raw.Participant1;
  const awayId = raw.Participant1IsHome ? raw.Participant2Id : raw.Participant1Id;
  const homeScore = raw.Participant1IsHome ? p1 : p2;
  const awayScore = raw.Participant1IsHome ? p2 : p1;
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
    verification,
  };
}

async function loadAll(): Promise<Fixture[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.fixtures;

  const today = Math.floor(Date.now() / 86_400_000);
  const days = [today - 2, today - 1, today, today + 1, today + 2, today + 3];

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
