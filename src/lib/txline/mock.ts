import { fnv1a, seededRandom } from "@/lib/utils";
import type {
  Fixture,
  MatchEvent,
  MatchResult,
  MatchStatus,
  Odds,
  Team,
  TxLineClient,
} from "./types";

/**
 * Mock TxLINE provider.
 *
 * Generates World Cup 2026 Round-of-32 fixtures whose live state is derived
 * from the wall clock, so scores, minutes and odds evolve in real time during a
 * demo without any backend. Everything is deterministic per-fixture (seeded by
 * id) so reloads are consistent. Swapped for `live.ts` once TxLINE credentials
 * are available — the UI is identical either way.
 */

const TEAMS: Record<string, Team> = {
  ARG: { id: "ARG", name: "Argentina", code: "ARG", flag: "🇦🇷", iso: "ar" },
  FRA: { id: "FRA", name: "France", code: "FRA", flag: "🇫🇷", iso: "fr" },
  BRA: { id: "BRA", name: "Brazil", code: "BRA", flag: "🇧🇷", iso: "br" },
  ENG: { id: "ENG", name: "England", code: "ENG", flag: "🏴", iso: "gb-eng" },
  ESP: { id: "ESP", name: "Spain", code: "ESP", flag: "🇪🇸", iso: "es" },
  POR: { id: "POR", name: "Portugal", code: "POR", flag: "🇵🇹", iso: "pt" },
  NED: { id: "NED", name: "Netherlands", code: "NED", flag: "🇳🇱", iso: "nl" },
  GER: { id: "GER", name: "Germany", code: "GER", flag: "🇩🇪", iso: "de" },
  USA: { id: "USA", name: "USA", code: "USA", flag: "🇺🇸", iso: "us" },
  MEX: { id: "MEX", name: "Mexico", code: "MEX", flag: "🇲🇽", iso: "mx" },
  CRO: { id: "CRO", name: "Croatia", code: "CRO", flag: "🇭🇷", iso: "hr" },
  MAR: { id: "MAR", name: "Morocco", code: "MAR", flag: "🇲🇦", iso: "ma" },
  JPN: { id: "JPN", name: "Japan", code: "JPN", flag: "🇯🇵", iso: "jp" },
  BEL: { id: "BEL", name: "Belgium", code: "BEL", flag: "🇧🇪", iso: "be" },
  URU: { id: "URU", name: "Uruguay", code: "URU", flag: "🇺🇾", iso: "uy" },
  COL: { id: "COL", name: "Colombia", code: "COL", flag: "🇨🇴", iso: "co" },
};

interface FixtureTemplate {
  id: string;
  home: string;
  away: string;
  stage: string;
  venue: string;
  /** Minutes from "now" that the match kicks off (negative = already started). */
  kickoffOffsetMin: number;
}

/**
 * Kickoff offsets are relative to the current time so there is always a spread
 * of finished / live / upcoming matches whenever the demo is opened.
 */
const TEMPLATES: FixtureTemplate[] = [
  { id: "wc-r32-01", home: "ARG", away: "JPN", stage: "Round of 32", venue: "MetLife Stadium, New York", kickoffOffsetMin: -130 },
  { id: "wc-r32-02", home: "ESP", away: "MEX", stage: "Round of 32", venue: "SoFi Stadium, Los Angeles", kickoffOffsetMin: -35 },
  { id: "wc-r32-03", home: "FRA", away: "USA", stage: "Round of 32", venue: "AT&T Stadium, Dallas", kickoffOffsetMin: -12 },
  { id: "wc-r32-04", home: "BRA", away: "COL", stage: "Round of 32", venue: "Estadio Azteca, Mexico City", kickoffOffsetMin: -3 },
  { id: "wc-r32-05", home: "ENG", away: "URU", stage: "Round of 32", venue: "Hard Rock Stadium, Miami", kickoffOffsetMin: 45 },
  { id: "wc-r32-06", home: "POR", away: "CRO", stage: "Round of 32", venue: "Levi's Stadium, San Francisco", kickoffOffsetMin: 150 },
  { id: "wc-r32-07", home: "NED", away: "MAR", stage: "Round of 32", venue: "BC Place, Vancouver", kickoffOffsetMin: 210 },
  { id: "wc-r32-08", home: "GER", away: "BEL", stage: "Round of 32", venue: "Arrowhead Stadium, Kansas City", kickoffOffsetMin: 1440 },
];

/** Relative "strength" 0..1 used to seed base odds. */
function teamStrength(code: string): number {
  return 0.35 + seededRandom(fnv1a(`strength-${code}`)) * 0.6;
}

/**
 * Match clock model: 45' first half, 15' break, 45' second half.
 * Returns display minute + status from real minutes elapsed since kickoff.
 */
function matchClock(elapsedMin: number): { minute: number; status: MatchStatus } {
  if (elapsedMin < 0) return { minute: 0, status: "scheduled" };
  if (elapsedMin < 45) return { minute: Math.floor(elapsedMin) + 1, status: "live" };
  if (elapsedMin < 60) return { minute: 45, status: "halftime" };
  if (elapsedMin < 105) return { minute: Math.floor(elapsedMin) - 15 + 1, status: "live" };
  return { minute: 90, status: "finished" };
}

/** Deterministic goal minutes for a side, seeded by fixture + side. */
function goalMinutes(fixtureId: string, side: "home" | "away", strength: number): number[] {
  const seed = fnv1a(`${fixtureId}-${side}`);
  // Expected goals scale with strength (roughly 0.6–2.4).
  const xg = 0.6 + strength * 1.8;
  const minutes: number[] = [];
  for (let i = 0; i < 5; i++) {
    const r = seededRandom(seed + i * 97);
    if (r < xg / 5) {
      minutes.push(1 + Math.floor(seededRandom(seed + i * 131) * 89));
    }
  }
  return minutes.sort((a, b) => a - b);
}

function computeOdds(
  strengthHome: number,
  strengthAway: number,
  homeScore: number,
  awayScore: number,
  minute: number,
  updatedAt: string,
): Odds {
  // Base implied probabilities from strength, with home edge.
  let pHome = strengthHome * 1.1;
  let pAway = strengthAway;
  let pDraw = 0.28;
  // Scoreline + time pressure shift the market.
  const lead = homeScore - awayScore;
  const timeFactor = Math.min(minute / 90, 1);
  pHome += lead * 0.18 * timeFactor;
  pAway -= lead * 0.18 * timeFactor;
  pDraw -= Math.abs(lead) * 0.12 * timeFactor;
  pHome = Math.max(0.05, pHome);
  pAway = Math.max(0.05, pAway);
  pDraw = Math.max(0.05, pDraw);
  const total = pHome + pDraw + pAway;
  // Add ~5% bookmaker margin, convert to decimal odds.
  const margin = 1.05;
  return {
    home: +(total / pHome / margin).toFixed(2),
    draw: +(total / pDraw / margin).toFixed(2),
    away: +(total / pAway / margin).toFixed(2),
    updatedAt,
  };
}

/** Simulated Solana verification anchor (replaced by real TxLINE proofs live). */
function verification(fixtureId: string, publishedAt: number): Fixture["verification"] {
  const seed = fnv1a(`verify-${fixtureId}`);
  const b58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const hex = "0123456789abcdef";
  let sig = "";
  for (let i = 0; i < 88; i++) sig += b58[Math.floor(seededRandom(seed + i) * b58.length)];
  let root = "";
  for (let i = 0; i < 64; i++) root += hex[Math.floor(seededRandom(seed + 1000 + i) * hex.length)];
  return { signature: sig, merkleRoot: `0x${root}`, publishedAt, cluster: "devnet" };
}

function buildFixture(t: FixtureTemplate, now: number): Fixture {
  const kickoff = now + t.kickoffOffsetMin * 60_000;
  const elapsedMin = (now - kickoff) / 60_000;
  const { minute, status } = matchClock(elapsedMin);

  const home = TEAMS[t.home];
  const away = TEAMS[t.away];
  const sHome = teamStrength(t.home);
  const sAway = teamStrength(t.away);

  const homeGoals = goalMinutes(t.id, "home", sHome);
  const awayGoals = goalMinutes(t.id, "away", sAway);
  const displayMin = status === "scheduled" ? 0 : minute;
  const homeScore = homeGoals.filter((m) => m <= displayMin).length;
  const awayScore = awayGoals.filter((m) => m <= displayMin).length;

  const events: MatchEvent[] = [];
  if (status !== "scheduled") events.push({ minute: 0, type: "kickoff" });
  homeGoals.filter((m) => m <= displayMin).forEach((m) => events.push({ minute: m, type: "goal", team: "home" }));
  awayGoals.filter((m) => m <= displayMin).forEach((m) => events.push({ minute: m, type: "goal", team: "away" }));
  if (displayMin >= 45 && status !== "scheduled") events.push({ minute: 45, type: "halftime" });
  if (status === "finished") events.push({ minute: 90, type: "fulltime" });
  events.sort((a, b) => a.minute - b.minute);

  const nowIso = new Date(now).toISOString();
  const odds = computeOdds(sHome, sAway, homeScore, awayScore, displayMin, nowIso);

  // Finished (and in-play) matches carry an on-chain verification anchor.
  const verif =
    status === "finished" || status === "live" || status === "halftime"
      ? verification(t.id, Math.floor(kickoff / 1000) + minute * 60)
      : undefined;

  return {
    id: t.id,
    stage: t.stage,
    venue: t.venue,
    kickoff: new Date(kickoff).toISOString(),
    status,
    minute: status === "scheduled" ? null : minute,
    home,
    away,
    homeScore,
    awayScore,
    odds,
    events,
    verification: verif,
  };
}

export class MockTxLineClient implements TxLineClient {
  readonly source = "mock" as const;

  private all(): Fixture[] {
    const now = Date.now();
    return TEMPLATES.map((t) => buildFixture(t, now));
  }

  async getFixtures(status?: MatchStatus): Promise<Fixture[]> {
    const fixtures = this.all();
    const filtered = status ? fixtures.filter((f) => f.status === status) : fixtures;
    // Live first, then upcoming, then finished.
    const rank: Record<MatchStatus, number> = {
      live: 0,
      halftime: 0,
      scheduled: 1,
      finished: 2,
      postponed: 3,
    };
    return filtered.sort(
      (a, b) => rank[a.status] - rank[b.status] || +new Date(a.kickoff) - +new Date(b.kickoff),
    );
  }

  async getFixture(id: string): Promise<Fixture | null> {
    return this.all().find((f) => f.id === id) ?? null;
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
