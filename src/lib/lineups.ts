import { fnv1a, seededRandom } from "@/lib/utils";
import type { Fixture } from "@/lib/txline";

/**
 * Deterministic lineups, player ratings and head-to-head history — the
 * SofaScore feature set, generated from the fixture seed so it's stable across
 * reloads and coherent with the match state. Swaps for the real TxLINE
 * lineups feed when available.
 */

export interface PlayerSlot {
  number: number;
  name: string;
  role: string; // GK / DF / MF / FW
  rating: number; // 5.8 .. 9.4
  star: boolean; // best on pitch
  x: number; // 0..100 across pitch width
  row: number; // 0 = GK, increasing toward attack
}

export interface Lineup {
  formation: string;
  players: PlayerSlot[];
  rows: number; // total rows incl. GK
}

const FORMATIONS = ["4-3-3", "4-2-3-1", "4-4-2", "3-5-2"] as const;

const SURNAMES = [
  "Silva", "García", "Müller", "Rossi", "Kovač", "Sato", "Diallo", "Haddad",
  "Novak", "Peeters", "Jensen", "Costa", "Nkosi", "Ivanov", "Ramos", "Dubois",
  "Okafor", "Yamada", "Fernández", "Schmidt", "Moreau", "Bianchi", "Petrov",
  "Kim", "Traoré", "Vargas", "Berg", "Santos", "Ali", "Mensah", "Castro",
  "Weber", "Tanaka", "Osei", "Lopez", "Nagy", "Amrani", "Vidal", "Klein", "Fofana",
] as const;

function pickName(seed: number, used: Set<number>): string {
  for (let i = 0; i < 40; i++) {
    const idx = Math.floor(seededRandom(seed + i * 31) * SURNAMES.length);
    if (!used.has(idx)) {
      used.add(idx);
      return SURNAMES[idx];
    }
  }
  return SURNAMES[seed % SURNAMES.length];
}

export function computeLineup(fixture: Fixture, side: "home" | "away"): Lineup {
  const team = fixture[side];
  const seed = fnv1a(`lineup-${fixture.id}-${team.code}`);
  const formation = FORMATIONS[Math.floor(seededRandom(seed) * FORMATIONS.length)];
  const rows = formation.split("-").map(Number); // e.g. [4,3,3]

  const used = new Set<number>();
  const players: PlayerSlot[] = [];

  // Ratings only meaningful once the match is underway.
  const rated = fixture.status !== "scheduled";
  const scored = side === "home" ? fixture.homeScore : fixture.awayScore;
  const conceded = side === "home" ? fixture.awayScore : fixture.homeScore;
  // Team performance nudges the whole XI's ratings.
  const teamForm = 6.7 + (scored - conceded) * 0.25;

  const mkRating = (i: number) => {
    if (!rated) return 0;
    const r = teamForm + (seededRandom(seed + 100 + i) - 0.5) * 1.6;
    return Math.min(9.4, Math.max(5.6, +r.toFixed(1)));
  };

  // GK
  players.push({
    number: 1,
    name: pickName(seed + 1, used),
    role: "GK",
    rating: mkRating(0),
    star: false,
    x: 50,
    row: 0,
  });

  let num = 2;
  rows.forEach((count, rowIdx) => {
    for (let i = 0; i < count; i++) {
      const x = ((i + 1) / (count + 1)) * 100;
      players.push({
        number: num,
        name: pickName(seed + num * 7, used),
        role: rowIdx === 0 ? "DF" : rowIdx === rows.length - 1 ? "FW" : "MF",
        rating: mkRating(num),
        star: false,
        x,
        row: rowIdx + 1,
      });
      num++;
    }
  });

  if (rated) {
    const best = players.reduce((a, b) => (b.rating > a.rating ? b : a), players[0]);
    best.star = true;
  }

  return { formation, players, rows: rows.length + 1 };
}

/* ---------------- Head-to-head ---------------- */

export interface H2HMeeting {
  label: string; // e.g. "WC 2022 · Group stage"
  homeCode: string;
  awayCode: string;
  homeScore: number;
  awayScore: number;
}

export interface H2HSummary {
  meetings: H2HMeeting[];
  homeWins: number;
  draws: number;
  awayWins: number;
}

const COMPETITIONS = [
  "World Cup 2022",
  "Continental Cup 2024",
  "WC Qualifier 2025",
  "Friendly 2025",
  "Nations League 2024",
] as const;

export function computeH2H(fixture: Fixture): H2HSummary {
  const seed = fnv1a(`h2h-${[fixture.home.code, fixture.away.code].sort().join("-")}`);
  const n = 4 + Math.floor(seededRandom(seed) * 2); // 4-5 meetings
  const meetings: H2HMeeting[] = [];
  let homeWins = 0;
  let draws = 0;
  let awayWins = 0;

  for (let i = 0; i < n; i++) {
    const flip = seededRandom(seed + i * 13) > 0.5; // who hosted
    const a = Math.floor(seededRandom(seed + i * 17) * 4);
    const b = Math.floor(seededRandom(seed + i * 23) * 3);
    const homeCode = flip ? fixture.home.code : fixture.away.code;
    const awayCode = flip ? fixture.away.code : fixture.home.code;
    meetings.push({
      label: COMPETITIONS[i % COMPETITIONS.length],
      homeCode,
      awayCode,
      homeScore: a,
      awayScore: b,
    });
    // Tally from the perspective of the current fixture's home team.
    const currHomeGoals = homeCode === fixture.home.code ? a : b;
    const currAwayGoals = homeCode === fixture.home.code ? b : a;
    if (currHomeGoals > currAwayGoals) homeWins++;
    else if (currHomeGoals < currAwayGoals) awayWins++;
    else draws++;
  }

  return { meetings, homeWins, draws, awayWins };
}
