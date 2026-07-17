"use client";

import type { Pick } from "@/lib/solana/commitment";
import type { Fixture, MatchResult } from "@/lib/txline";

/** A committed prediction with its on-chain anchor and settlement state. */
export interface Prediction {
  id: string;
  fixtureId: string;
  matchLabel: string; // e.g. "ARG vs JPN"
  pick: Pick;
  createdAt: number;
  kickoff: string;
  /** SHA-256 of the commitment (what's anchored). */
  hash: string;
  /** On-chain anchor tx signature. */
  signature: string;
  explorer: string;
  cluster: string;
  simulated: boolean;
  /** Decimal odds captured at commit time — drives the payout. */
  oddsAtCommit: number;
  /** Points wagered (like a stake). Return if correct = stake × odds. */
  stake: number;
  status: "pending" | "won" | "lost" | "void";
  points: number;
}

const KEY = "matchpulse.predictions.v1";

export function loadPredictions(): Prediction[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as Prediction[];
  } catch {
    return [];
  }
}

function save(predictions: Prediction[]): void {
  localStorage.setItem(KEY, JSON.stringify(predictions));
  window.dispatchEvent(new Event("matchpulse:predictions"));
}

export function addPrediction(p: Prediction): void {
  const all = loadPredictions();
  save([p, ...all]);
}

/** Has the user already predicted this market for this fixture? */
export function existingPrediction(fixtureId: string, market: Pick["market"]): Prediction | undefined {
  return loadPredictions().find((p) => p.fixtureId === fixtureId && p.pick.market === market);
}

/** Payout for a correct call: stake × odds (odds captured at commit time). */
export function pointsFor(oddsAtCommit: number, stake = 100): number {
  return Math.round(stake * oddsAtCommit);
}

function isCorrect(pick: Pick, result: MatchResult): "won" | "lost" | "void" {
  switch (pick.market) {
    case "1x2":
      return pick.value === result.outcome ? "won" : "lost";
    case "over_under": {
      if (result.totalGoals === pick.line) return "void"; // push
      const over = result.totalGoals > pick.line;
      return (pick.value === "over") === over ? "won" : "lost";
    }
    case "next_goal":
      return "void"; // settled live elsewhere; not graded post-hoc
  }
}

/**
 * Settles any pending predictions whose match is now final. Returns the updated
 * list and whether anything changed (so callers can surface a toast).
 */
export function settlePending(fixtures: Fixture[]): { updated: Prediction[]; changed: boolean } {
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  let changed = false;
  const updated = loadPredictions().map((p) => {
    if (p.status !== "pending") return p;
    const f = byId.get(p.fixtureId);
    if (!f || f.status !== "finished") return p;
    const result: MatchResult = {
      fixtureId: f.id,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      outcome: f.homeScore > f.awayScore ? "home" : f.homeScore < f.awayScore ? "away" : "draw",
      totalGoals: f.homeScore + f.awayScore,
      finishedAt: f.kickoff,
    };
    const outcome = isCorrect(p.pick, result);
    changed = true;
    return {
      ...p,
      status: outcome,
      points: outcome === "won" ? pointsFor(p.oddsAtCommit, p.stake ?? 100) : 0,
    };
  });
  if (changed) save(updated);
  return { updated, changed };
}

export interface UserStats {
  points: number;
  settled: number;
  won: number;
  pending: number;
  accuracy: number; // 0..1
  streak: number; // current consecutive wins (most recent first)
  bestStreak: number;
}

export function computeStats(predictions: Prediction[]): UserStats {
  const settled = predictions.filter((p) => p.status === "won" || p.status === "lost");
  const won = settled.filter((p) => p.status === "won").length;
  const points = predictions.reduce((sum, p) => sum + p.points, 0);

  // Streak over settled predictions, newest first.
  const chron = [...settled].sort((a, b) => a.createdAt - b.createdAt);
  let best = 0;
  let run = 0;
  for (const p of chron) {
    if (p.status === "won") {
      run++;
      best = Math.max(best, run);
    } else run = 0;
  }
  // current streak = trailing run
  let current = 0;
  for (let i = chron.length - 1; i >= 0; i--) {
    if (chron[i].status === "won") current++;
    else break;
  }

  return {
    points,
    settled: settled.length,
    won,
    pending: predictions.filter((p) => p.status === "pending").length,
    accuracy: settled.length ? won / settled.length : 0,
    streak: current,
    bestStreak: best,
  };
}
