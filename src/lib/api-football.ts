import "server-only";

const API_KEY = process.env.API_FOOTBALL_KEY;
const HOST = "https://v3.football.api-sports.io";

/**
 * API-Football (v3) enrichment layer.
 *
 * TxLINE is the real-time + on-chain source of truth (fixtures, live score,
 * odds, Solana verification). API-Football supplies the *rich human detail*
 * TxLINE's thinned feed doesn't carry: real goal minutes + scorers, shots,
 * fouls, possession, cards, substitutions, and full lineups with player photos.
 *
 * The hard constraint is the Free plan: **100 requests/day** and only dates in a
 * ±1-day window around today are accessible. Every fetch is therefore cached
 * per-endpoint with a TTL tuned to how fast the data changes — finished matches
 * are cached for hours (their data is final), live matches for a few minutes,
 * and the daily fixture list for a day. During a live match the *score* still
 * updates every couple of seconds via TxLINE; API-Football only refreshes the
 * heavier stats periodically, which keeps us comfortably under the daily cap.
 */

// TTLs (ms).
const TTL_DAILY = 24 * 3600_000; // fixture list for a date — effectively static
const TTL_FINISHED = 12 * 3600_000; // final match data never changes
const TTL_LIVE = 300_000; // live stats/events — refresh every 5 min
const TTL_LINEUPS = 12 * 3600_000; // starting XI is set at kickoff, then stable

// In-memory cache to stay under the 100 req/day limit. In production this would
// be Redis or a DB; a single Node process is enough for the hackathon demo.
const cache = new Map<string, { data: any; at: number }>();

async function fetchAPI(endpoint: string, ttlMs: number): Promise<any> {
  if (!API_KEY) return null;
  const cached = cache.get(endpoint);
  if (cached && Date.now() - cached.at < ttlMs) return cached.data;

  try {
    const res = await fetch(`${HOST}${endpoint}`, {
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": "v3.football.api-sports.io",
      },
    });
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
      // Out-of-window dates on the Free plan land here (e.g. "Free plans do not
      // have access to this date"). Cache the empty result so we don't re-spend
      // the daily budget hammering a date we can never read.
      cache.set(endpoint, { data: { ...json, response: [] }, at: Date.now() });
      return { ...json, response: [] };
    }
    cache.set(endpoint, { data: json, at: Date.now() });
    return json;
  } catch (e) {
    console.error("API-Football fetch failed:", e);
    return null;
  }
}

/** Fetch all fixtures for a date (YYYY-MM-DD). Cached ~24h. */
export async function getDailyFixtures(dateIso: string): Promise<any[]> {
  const json = await fetchAPI(`/fixtures?date=${dateIso}`, TTL_DAILY);
  return json?.response ?? [];
}

/** Lineups (startXI + subs, formation, grid, coach) for an API-Football fixture. */
export async function getLineups(fixtureId: number, ttlMs = TTL_LINEUPS): Promise<any[]> {
  const json = await fetchAPI(`/fixtures/lineups?fixture=${fixtureId}`, ttlMs);
  return json?.response ?? [];
}

/** Timeline events (goals, cards, subs, VAR) with minute + player + assist. */
export async function getEvents(fixtureId: number, ttlMs: number): Promise<any[]> {
  const json = await fetchAPI(`/fixtures/events?fixture=${fixtureId}`, ttlMs);
  return json?.response ?? [];
}

/** Per-team statistics (shots, possession, fouls, corners, xG, passes…). */
export async function getStatistics(fixtureId: number, ttlMs: number): Promise<any[]> {
  const json = await fetchAPI(`/fixtures/statistics?fixture=${fixtureId}`, ttlMs);
  return json?.response ?? [];
}

const normalize = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");

/**
 * Find the API-Football fixture id for a TxLINE match by fuzzy team-name match
 * on a given date. Free-plan-safe: the daily list is cached.
 */
export async function matchFixtureToApiFootball(
  dateIso: string,
  homeName: string,
  awayName: string,
): Promise<number | null> {
  const daily = await getDailyFixtures(dateIso);
  if (!daily || daily.length === 0) return null;

  const hNorm = normalize(homeName);
  const aNorm = normalize(awayName);
  for (const match of daily) {
    const fHome = normalize(match.teams?.home?.name ?? "");
    const fAway = normalize(match.teams?.away?.name ?? "");
    const homeOk = fHome && (fHome.includes(hNorm) || hNorm.includes(fHome));
    const awayOk = fAway && (fAway.includes(aNorm) || aNorm.includes(fAway));
    if (homeOk && awayOk) return match.fixture.id;
  }
  return null;
}

export interface ApiFootballDetail {
  apiId: number;
  events: any[];
  statistics: any[];
  lineups: any[];
}

/**
 * Resolve + fetch the full rich detail for a TxLINE fixture from API-Football.
 * Returns null when the fixture can't be matched (e.g. an out-of-window date the
 * Free plan can't read). Tries the kickoff date and ±1 day to absorb any
 * timezone/date skew between the two providers.
 */
export async function getApiFootballDetail(
  dateIso: string,
  homeName: string,
  awayName: string,
  opts: { live: boolean },
): Promise<ApiFootballDetail | null> {
  if (!API_KEY) return null;

  const base = new Date(`${dateIso}T00:00:00Z`);
  const candidates = [0, -1, 1].map((d) => {
    const dt = new Date(base);
    dt.setUTCDate(dt.getUTCDate() + d);
    return dt.toISOString().split("T")[0];
  });

  let apiId: number | null = null;
  for (const date of candidates) {
    apiId = await matchFixtureToApiFootball(date, homeName, awayName);
    if (apiId) break;
  }
  if (!apiId) return null;

  const ttl = opts.live ? TTL_LIVE : TTL_FINISHED;
  const [events, statistics, lineups] = await Promise.all([
    getEvents(apiId, ttl),
    getStatistics(apiId, ttl),
    getLineups(apiId, TTL_LINEUPS),
  ]);
  return { apiId, events, statistics, lineups };
}
