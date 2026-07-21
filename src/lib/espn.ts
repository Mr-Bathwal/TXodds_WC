import "server-only";
import type { FeedEvent, LineupPlayer, LiveDetail, MatchEvent, MatchStatus } from "./txline/types";

/**
 * ESPN public soccer API — the authoritative match-detail layer.
 *
 * TxLINE is MatchPulse's real-time + on-chain source of truth (fixtures, live
 * score, de-margined odds, Solana verification). Its thinned public feed does
 * NOT carry the human detail a match page wants: goal scorers + assists +
 * minutes, full lineups with formations, and per-team statistics. ESPN's free,
 * key-less JSON API does — and because the TxLINE dev feed mirrors the real
 * 2026 World Cup, ESPN's real records line up match-for-match.
 *
 *   scoreboard?dates=YYYYMMDD  -> games that day (resolve gameId by date+teams)
 *   summary?event={gameId}     -> keyEvents (scorers/assists/subs/cards), rosters
 *                                 (formation + XI), boxscore (28 team stats)
 *
 * This is an *unofficial* endpoint (no key, no documented SLA), so every fetch
 * is cached per-endpoint with a TTL tuned to volatility: a finished match's
 * data is immutable (cached hours), the daily scoreboard for a past date is
 * static (cached a day), and a live match refreshes on the minute. Everything
 * degrades gracefully to TxLINE-only if ESPN is unreachable.
 */

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";

// TTLs (ms).
const TTL_SCOREBOARD = 24 * 3600_000; // a date's game list is effectively static
const TTL_FINISHED = 6 * 3600_000; // final match data never changes
const TTL_LIVE = 60_000; // in-play summary — refresh on the minute

const cache = new Map<string, { data: unknown; at: number }>();

async function fetchJson(url: string, ttlMs: number): Promise<any | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (MatchPulse)" } });
    if (!res.ok) {
      // Cache the miss briefly so a bad date/id doesn't get hammered every poll.
      cache.set(url, { data: null, at: Date.now() });
      return null;
    }
    const json = await res.json();
    cache.set(url, { data: json, at: Date.now() });
    return json;
  } catch (e) {
    console.error("ESPN fetch failed:", url, e);
    return null;
  }
}

const norm = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");

// Country-name variants that differ between TxLINE and ESPN. Each row is one
// team; any member matches any other. Keeps fixtures like "USA" ↔ "United
// States" or "Korea Republic" ↔ "South Korea" from silently falling back to
// synthesized detail. Normalized (lowercase, letters only) at build time.
const ALIAS_GROUPS = [
  ["usa", "unitedstates", "unitedstatesofamerica"],
  ["southkorea", "korearepublic", "korea"],
  ["northkorea", "koreadpr", "koreadprkorea"],
  ["iran", "iranislamicrepublic", "iriran"],
  ["ivorycoast", "cotedivoire"],
  ["china", "chinapr"],
  ["czechia", "czechrepublic"],
  ["capeverde", "caboverde"],
  ["turkey", "turkiye"],
  ["bosniaherzegovina", "bosniaandherzegovina", "bosnia"],
  ["drcongo", "congodr", "democraticrepublicofthecongo"],
].map((g) => g.map(norm));
const aliasGroupOf = (n: string): number => ALIAS_GROUPS.findIndex((g) => g.includes(n));

const namesMatch = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const gx = aliasGroupOf(x);
  return gx !== -1 && gx === aliasGroupOf(y);
};

/** YYYY-MM-DD -> ESPN's YYYYMMDD, offset by `deltaDays`. */
function espnDate(dateIso: string, deltaDays: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Resolve the ESPN gameId for a fixture by date + team names. Tries the kickoff
 * date and ±1 day to absorb any timezone/date skew between TxLINE and ESPN.
 */
async function resolveGameId(dateIso: string, homeName: string, awayName: string): Promise<string | null> {
  for (const delta of [0, -1, 1]) {
    const sb = await fetchJson(`${BASE}/scoreboard?dates=${espnDate(dateIso, delta)}`, TTL_SCOREBOARD);
    for (const ev of sb?.events ?? []) {
      const cs = ev?.competitions?.[0]?.competitors ?? [];
      const names = cs.map((c: any) => c?.team?.displayName ?? "");
      if (names.length !== 2) continue;
      const hitHome = names.some((n: string) => namesMatch(n, homeName));
      const hitAway = names.some((n: string) => namesMatch(n, awayName));
      if (hitHome && hitAway) return String(ev.id);
    }
  }
  return null;
}

/* ------------------------------ event parsing ------------------------------ */

/** "3'", "45'+1'", "90'+6'" -> additive minute (46, 96). */
function parseClock(display: string | undefined): number {
  if (!display) return 0;
  const m = String(display).match(/(\d+)(?:'?\s*\+\s*(\d+))?/);
  if (!m) return 0;
  return Number(m[1] || 0) + Number(m[2] || 0);
}

const athlete = (p: any): string | undefined => p?.athlete?.displayName || p?.athlete?.shortName || undefined;

/* ------------------------------ lineup grid ------------------------------ */
/**
 * Turn ESPN's per-player position ("Center Left Defender", "Defensive
 * Midfielder", …) + the team formation ("4-2-3-1") into pitch grid coordinates
 * the LineupPitch renderer understands: `gridY` = row (1 = keeper, ascending
 * toward the opponent goal), `gridX` = 1..N slot within that row, left→right.
 *
 * ESPN's own `formationPlace` is a fixed positional code, not row-ordered, so
 * we instead rank each outfielder by how advanced their position is, then slice
 * that ordering into the bands the formation string declares (e.g. 4-2-3-1 ->
 * rows of 4, 2, 3, 1). Because ESPN's position vocabulary and the formation
 * counts are consistent, the slice lands each player in the right band.
 */
function positionName(p: any): string {
  return String(p?.position?.displayName || p?.position?.name || p?.position?.abbreviation || "").toLowerCase();
}

/** Rank by depth from own goal: keeper 0 → forward 5. */
function depthRank(p: any): number {
  const n = positionName(p);
  if (n.includes("keeper")) return 0;
  if (n.includes("forward") || n.includes("striker")) return 5;
  if (n.includes("attacking mid") || n.includes("winger") || n.includes("wing")) return 4;
  if (n.includes("defensive mid")) return 2;
  if (n.includes("midfield")) return 3;
  if (n.includes("defender") || n.includes("back")) return 1;
  return 3; // unknown -> treat as central midfield
}

/** Rank left(−2)→right(+2) from the position name. */
function horizRank(p: any): number {
  const n = positionName(p);
  const center = n.includes("center") || n.includes("centre");
  if (n.includes("left")) return center ? -1 : -2;
  if (n.includes("right")) return center ? 1 : 2;
  return 0;
}

function buildLineup(roster: any[]): LineupPlayer[] {
  const starters = (roster ?? []).filter((p) => p.starter);
  if (!starters.length) return [];

  const gk = starters.filter((p) => depthRank(p) === 0);
  const outfield = starters
    .filter((p) => depthRank(p) !== 0)
    .sort((a, b) => depthRank(a) - depthRank(b) || Number(a.formationPlace ?? 0) - Number(b.formationPlace ?? 0));

  const toPlayer = (p: any, gridX: number, gridY: number): LineupPlayer => ({
    number: Number(p.jersey ?? 0),
    positionId: 0,
    starter: true,
    name: p?.athlete?.displayName || p?.athlete?.shortName,
    photo: p?.jerseyImages?.find((j: any) => j?.href)?.href,
    pos: p?.position?.abbreviation,
    gridX,
    gridY,
  });

  const out: LineupPlayer[] = gk.map((p) => toPlayer(p, 1, 1));

  // Band sizes from the formation string; fall back to one band per depth tier.
  const teamFormation = roster?.[0]?.__formation as string | undefined;
  let bands = String(teamFormation ?? "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => n > 0);
  if (bands.reduce((s, n) => s + n, 0) !== outfield.length) {
    // Formation missing/inconsistent — group by depth tier instead.
    bands = [];
    let prev = -1;
    for (const p of outfield) {
      const d = depthRank(p);
      if (d !== prev) bands.push(0);
      bands[bands.length - 1]++;
      prev = d;
    }
  }

  let i = 0;
  bands.forEach((size, bandIdx) => {
    const rowPlayers = outfield.slice(i, i + size).sort((a, b) => horizRank(a) - horizRank(b));
    rowPlayers.forEach((p, col) => out.push(toPlayer(p, col + 1, bandIdx + 2)));
    i += size;
  });
  return out;
}

/* ------------------------------ shaping ------------------------------ */

export interface EspnDetail {
  gameId: string;
  events: MatchEvent[];
  live: LiveDetail;
  corners: [number, number];
  yellowCards: [number, number];
}

/**
 * Fetch + shape the full real match detail for a TxLINE fixture from ESPN.
 * Returns null when the game can't be resolved (unknown date/teams) or ESPN is
 * unreachable — the caller then falls back to TxLINE-only / synthesized detail.
 */
export async function getEspnDetail(
  dateIso: string,
  homeName: string,
  awayName: string,
  opts: { live: boolean; status: MatchStatus; proofDepth?: number; baseLive?: LiveDetail },
): Promise<EspnDetail | null> {
  const gameId = await resolveGameId(dateIso, homeName, awayName);
  if (!gameId) return null;

  const summary = await fetchJson(`${BASE}/summary?event=${gameId}`, opts.live ? TTL_LIVE : TTL_FINISHED);
  if (!summary) return null;

  // Resolve each ESPN team id -> MatchPulse home/away by NAME (TxLINE decides
  // which side is "home", not ESPN's own designation).
  const competitors = summary?.header?.competitions?.[0]?.competitors ?? [];
  const sideById = new Map<string, "home" | "away">();
  for (const c of competitors) {
    const name = c?.team?.displayName ?? "";
    if (namesMatch(name, homeName)) sideById.set(String(c?.team?.id), "home");
    else if (namesMatch(name, awayName)) sideById.set(String(c?.team?.id), "away");
  }
  const sideOf = (teamId: unknown): "home" | "away" | undefined => sideById.get(String(teamId));

  // ---- timeline + play-by-play feed from keyEvents ----
  const timeline: MatchEvent[] = [];
  const feed: FeedEvent[] = [];
  const evs = [...(summary?.keyEvents ?? [])].sort((a, b) => parseClock(a?.clock?.displayValue) - parseClock(b?.clock?.displayValue));

  for (const e of evs) {
    const min = parseClock(e?.clock?.displayValue);
    const side = sideOf(e?.team?.id);
    const typeText = String(e?.type?.text ?? "").toLowerCase();
    const text = String(e?.text ?? "");
    const parts = e?.participants ?? [];

    if (e?.scoringPlay || (/goal/.test(typeText) && !/disallowed|no goal|cancel/i.test(text))) {
      const own = /own goal/i.test(typeText) || /own goal/i.test(text);
      const pen = /penalty/i.test(typeText);
      const scorer = athlete(parts[0]);
      const assist = own ? undefined : athlete(parts[1]);
      timeline.push({ minute: min, type: "goal", team: side, player: scorer });
      feed.push({
        minute: min,
        kind: pen ? "penalty" : "goal",
        team: side,
        detail: [scorer, own ? "OG" : "", assist ? `assist ${assist}` : ""].filter(Boolean).join(" · ") || undefined,
      });
    } else if (/red card|second yellow/.test(typeText)) {
      timeline.push({ minute: min, type: "red", team: side, player: athlete(parts[0]) });
      feed.push({ minute: min, kind: "red", team: side, detail: athlete(parts[0]) });
    } else if (/yellow card/.test(typeText)) {
      timeline.push({ minute: min, type: "yellow", team: side, player: athlete(parts[0]) });
      feed.push({ minute: min, kind: "yellow", team: side, detail: athlete(parts[0]) });
    } else if (/substitution/.test(typeText)) {
      // participants[0] comes on, participants[1] goes off.
      feed.push({ minute: min, kind: "sub", team: side, detail: [athlete(parts[0]), athlete(parts[1])].filter(Boolean).join(" ⇄ ") || undefined });
    } else if (/\bvar\b|video review/.test(typeText)) {
      feed.push({ minute: min, kind: "var", team: side, detail: e?.text || undefined });
    }
  }

  // Broadcast-style markers.
  const markers: FeedEvent[] = [{ minute: 0, kind: "kickoff" }];
  const hadSecondHalf = opts.status === "finished" || evs.some((e) => parseClock(e?.clock?.displayValue) > 45);
  if (hadSecondHalf) markers.push({ minute: 45, kind: "halftime" });
  if (opts.status === "finished") markers.push({ minute: 90, kind: "fulltime" });
  const feedAll = [...markers, ...feed].sort((a, b) => a.minute - b.minute);

  // ---- per-team statistics from boxscore ----
  const boxTeams = summary?.boxscore?.teams ?? [];
  const statFor = (side: "home" | "away") => {
    const entry = boxTeams.find((t: any) => sideOf(t?.team?.id) === side);
    const map = new Map<string, number>();
    for (const s of entry?.statistics ?? []) {
      const v = parseFloat(String(s?.displayValue ?? s?.value ?? "").replace("%", ""));
      map.set(String(s?.name), Number.isFinite(v) ? v : 0);
    }
    return (name: string) => map.get(name) ?? 0;
  };
  const sh = statFor("home");
  const sa = statFor("away");

  // ---- lineups (attach formation onto roster[0] for the band parser) ----
  const rosters = summary?.rosters ?? [];
  const rosterFor = (side: "home" | "away") => rosters.find((r: any) => sideOf(r?.team?.id) === side);
  const playersOf = (ro: any): any[] => {
    if (!ro?.roster?.length) return [];
    const players = ro.roster.slice();
    if (players[0]) players[0] = { ...players[0], __formation: ro.formation };
    return players;
  };
  const homeRoster = rosterFor("home");
  const awayRoster = rosterFor("away");
  const homeXI = buildLineup(playersOf(homeRoster));
  const awayXI = buildLineup(playersOf(awayRoster));
  const lineup =
    homeXI.length && awayXI.length
      ? { home: homeXI, away: awayXI, formationHome: homeRoster?.formation, formationAway: awayRoster?.formation }
      : undefined;

  const pH = sh("possessionPct");
  const pA = sa("possessionPct");
  const possHome = pH || pA ? Math.round((pH / ((pH + pA) || 100)) * 100) : opts.baseLive?.possession.home ?? 50;
  const onTH = sh("shotsOnTarget");
  const onTA = sa("shotsOnTarget");
  const dangerHome = onTH + onTA > 0 ? Math.round((onTH / (onTH + onTA)) * 100) : possHome;

  const live: LiveDetail = {
    events: feedAll,
    possession: { home: possHome, away: 100 - possHome },
    danger: { home: dangerHome, away: 100 - dangerHome },
    shots: { home: sh("totalShots"), away: sa("totalShots"), onTargetHome: onTH, onTargetAway: onTA },
    freeKicks: { home: sh("foulsCommitted"), away: sa("foulsCommitted") },
    subs: [],
    redCards: { home: sh("redCards"), away: sa("redCards") },
    lineup,
    meta: opts.baseLive?.meta ?? {},
    proofDepth: opts.proofDepth,
    source: "espn",
  };

  return {
    gameId,
    events: timeline.sort((a, b) => a.minute - b.minute),
    live,
    corners: [sh("wonCorners"), sa("wonCorners")],
    yellowCards: [sh("yellowCards"), sa("yellowCards")],
  };
}
