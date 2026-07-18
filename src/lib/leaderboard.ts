"use client";

import { fnv1a, seededRandom } from "@/lib/utils";

export interface LeaderRow {
  rank: number;
  name: string;
  points: number;
  accuracy: number; // 0..1
  streak: number;
  isUser?: boolean;
}

/**
 * Demo competitive field. In a full build these come from the settlement
 * backend aggregating every anchored prediction; for the hackathon demo we seed
 * a believable field deterministically and merge the user's real score in.
 */
const HANDLES = [
  "goalmachine", "xg_wizard", "midfieldmaestro", "onthevolley", "tikitaka",
  "cleansheet", "stoppage_time", "golazo", "false9", "counterpress",
  "poacher", "libero", "catenaccio", "totalfootball", "nutmeg_king",
  "hattrick_hero", "setpiece_sam", "var_check", "extra_time", "penalty_box",
];

function seededField(): Omit<LeaderRow, "rank">[] {
  return HANDLES.map((name) => {
    const seed = fnv1a(name);
    // Bankroll balances — a believable field around/above the 10k starting stack.
    const points = 6_000 + Math.floor(seededRandom(seed) * 26_000);
    const accuracy = 0.4 + seededRandom(seed + 11) * 0.45;
    const streak = Math.floor(seededRandom(seed + 23) * 6);
    return { name, points, accuracy, streak };
  });
}

export function buildLeaderboard(user: {
  name: string;
  points: number;
  accuracy: number;
  streak: number;
}): LeaderRow[] {
  const field = seededField();
  const rows = [...field, { ...user, isUser: true }];
  rows.sort((a, b) => b.points - a.points || b.accuracy - a.accuracy);
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}
