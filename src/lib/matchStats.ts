import { fnv1a, seededRandom } from "@/lib/utils";
import type { Fixture } from "@/lib/txline";

/**
 * Deterministic match statistics + momentum series derived from a fixture.
 * Everything is seeded by fixture id and gated by the current minute, so the
 * numbers evolve live during a match, stay consistent across reloads, and are
 * always coherent with the scoreline (goals spike momentum, shots >= goals).
 * When the live TxLINE stats feed is wired in, this module is the only thing
 * that changes.
 */

export interface MatchStats {
  possessionHome: number; // 0..100
  shots: [number, number];
  onTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  xg: [number, number];
}

/** Momentum sample per minute: -1 (away dominance) .. +1 (home dominance). */
export interface MomentumPoint {
  minute: number;
  value: number;
  goal?: "home" | "away";
}

function goalMinutes(fixture: Fixture, team: "home" | "away"): number[] {
  return fixture.events
    .filter((e) => e.type === "goal" && e.team === team)
    .map((e) => e.minute);
}

export function computeStats(fixture: Fixture): MatchStats {
  const seed = fnv1a(`stats-${fixture.id}`);
  const minute = fixture.minute ?? 0;
  const t = Math.max(minute, 1) / 90; // match progress 0..1

  const homeGoals = fixture.homeScore;
  const awayGoals = fixture.awayScore;

  // Possession tilts slightly toward whoever is behind (chasing the game).
  const basePoss = 44 + seededRandom(seed) * 12;
  const chase = (awayGoals - homeGoals) * 2.5;
  const possessionHome = Math.round(Math.min(68, Math.max(32, basePoss + chase)));

  const scale = (base: number, i: number) =>
    Math.round(base * t + seededRandom(seed + i) * 3 * t);

  const shotsHome = Math.max(homeGoals + 1, scale(11, 1)) ;
  const shotsAway = Math.max(awayGoals + 1, scale(9, 2));
  const onTargetHome = Math.max(homeGoals, Math.round(shotsHome * (0.3 + seededRandom(seed + 3) * 0.2)));
  const onTargetAway = Math.max(awayGoals, Math.round(shotsAway * (0.3 + seededRandom(seed + 4) * 0.2)));

  return {
    possessionHome,
    shots: [shotsHome, shotsAway],
    onTarget: [onTargetHome, onTargetAway],
    corners: [scale(6, 5), scale(5, 6)],
    fouls: [scale(9, 7), scale(10, 8)],
    xg: [
      +(homeGoals * 0.7 + onTargetHome * 0.12 + seededRandom(seed + 9) * 0.3).toFixed(2),
      +(awayGoals * 0.7 + onTargetAway * 0.12 + seededRandom(seed + 10) * 0.3).toFixed(2),
    ],
  };
}

export function computeMomentum(fixture: Fixture): MomentumPoint[] {
  const seed = fnv1a(`momentum-${fixture.id}`);
  const minute = fixture.minute ?? 0;
  if (minute < 1) return [];

  const homeG = goalMinutes(fixture, "home");
  const awayG = goalMinutes(fixture, "away");

  const points: MomentumPoint[] = [];
  let drift = 0;
  for (let m = 1; m <= Math.min(minute, 90); m++) {
    // Random walk with mild mean reversion...
    drift += (seededRandom(seed + m) - 0.5) * 0.35;
    drift *= 0.92;
    let v = drift;
    // ...plus pressure spikes around goals (build-up before, surge after).
    for (const g of homeG) {
      const d = m - g;
      if (d >= -3 && d <= 4) v += (1 - Math.abs(d) / 5) * 0.9;
    }
    for (const g of awayG) {
      const d = m - g;
      if (d >= -3 && d <= 4) v -= (1 - Math.abs(d) / 5) * 0.9;
    }
    const p: MomentumPoint = { minute: m, value: Math.max(-1, Math.min(1, v)) };
    if (homeG.includes(m)) p.goal = "home";
    if (awayG.includes(m)) p.goal = "away";
    points.push(p);
  }
  return points;
}
