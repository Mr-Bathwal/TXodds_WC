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
  /** Points wagered (deducted from the bankroll). Return if correct = stake × odds. */
  stake: number;
  status: "pending" | "won" | "lost" | "void";
  points: number;
}

const KEY = "matchpulse.predictions.v1";
const BAL_KEY = "matchpulse.bankroll.v1";

/** Free-to-play economy knobs. */
export const START_BALANCE = 10_000;
export const MIN_STAKE = 10;
export const TOPUP_AMOUNT = 5_000;
const TOPUP_COOLDOWN = 24 * 60 * 60_000; // once per day
const BUST_THRESHOLD = 100; // below this you can always top up

interface Bankroll {
  balance: number;
  lastTopUp: number;
}

function emit() {
  window.dispatchEvent(new Event("matchpulse:predictions"));
}

/* ------------------------------ bankroll ------------------------------ */

function loadBankroll(): Bankroll {
  if (typeof window === "undefined") return { balance: START_BALANCE, lastTopUp: 0 };
  try {
    const raw = localStorage.getItem(BAL_KEY);
    if (!raw) return { balance: START_BALANCE, lastTopUp: 0 };
    return JSON.parse(raw) as Bankroll;
  } catch {
    return { balance: START_BALANCE, lastTopUp: 0 };
  }
}

function saveBankroll(b: Bankroll): void {
  localStorage.setItem(BAL_KEY, JSON.stringify(b));
  emit();
}

export function getBalance(): number {
  return Math.max(0, Math.round(loadBankroll().balance));
}

function adjustBalance(delta: number): void {
  const b = loadBankroll();
  b.balance = Math.max(0, b.balance + delta);
  saveBankroll(b);
}

/** True if a top-up is allowed (daily, or any time when nearly bust). */
export function canTopUp(): boolean {
  const b = loadBankroll();
  return b.balance < BUST_THRESHOLD || Date.now() - b.lastTopUp >= TOPUP_COOLDOWN;
}

/** Millis until the next daily top-up (0 if available now). */
export function topUpCooldownLeft(): number {
  const b = loadBankroll();
  if (b.balance < BUST_THRESHOLD) return 0;
  return Math.max(0, TOPUP_COOLDOWN - (Date.now() - b.lastTopUp));
}

export function topUp(): boolean {
  if (!canTopUp()) return false;
  const b = loadBankroll();
  b.balance += TOPUP_AMOUNT;
  b.lastTopUp = Date.now();
  saveBankroll(b);
  return true;
}

/* ------------------------------ predictions ------------------------------ */

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
  emit();
}

/** Place a bet: the stake is deducted from the bankroll and locked. */
export function addPrediction(p: Prediction): void {
  adjustBalance(-p.stake);
  save([p, ...loadPredictions()]);
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
 * Settles any pending predictions whose match is now final, crediting the
 * bankroll for wins (stake × odds) and refunding voids. The stake was already
 * deducted when the bet was placed, so a loss needs no further adjustment.
 */
export function settlePending(fixtures: Fixture[]): { updated: Prediction[]; changed: boolean } {
  const byId = new Map(fixtures.map((f) => [f.id, f]));
  let changed = false;
  let credit = 0;
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
    const stake = p.stake ?? 100;
    const payout = outcome === "won" ? pointsFor(p.oddsAtCommit, stake) : outcome === "void" ? stake : 0;
    credit += payout;
    return { ...p, status: outcome, points: outcome === "won" ? payout : 0 };
  });
  if (changed) {
    if (credit > 0) adjustBalance(credit);
    save(updated);
  }
  return { updated, changed };
}

export interface UserStats {
  balance: number; // spendable bankroll
  staked: number; // locked in open bets
  points: number; // = balance, kept for leaderboard sorting
  settled: number;
  won: number;
  pending: number;
  accuracy: number; // 0..1
  streak: number;
  bestStreak: number;
  netProfit: number; // balance + staked - START_BALANCE
}

export function computeStats(predictions: Prediction[]): UserStats {
  const settled = predictions.filter((p) => p.status === "won" || p.status === "lost");
  const won = settled.filter((p) => p.status === "won").length;
  const staked = predictions
    .filter((p) => p.status === "pending")
    .reduce((s, p) => s + (p.stake ?? 0), 0);
  const balance = getBalance();

  // Longest + current win streak over settled bets (chronological).
  const chron = [...settled].sort((a, b) => a.createdAt - b.createdAt);
  let best = 0;
  let run = 0;
  for (const p of chron) {
    if (p.status === "won") { run++; best = Math.max(best, run); } else run = 0;
  }
  let current = 0;
  for (let i = chron.length - 1; i >= 0; i--) {
    if (chron[i].status === "won") current++;
    else break;
  }

  return {
    balance,
    staked,
    points: balance,
    settled: settled.length,
    won,
    pending: predictions.filter((p) => p.status === "pending").length,
    accuracy: settled.length ? won / settled.length : 0,
    streak: current,
    bestStreak: best,
    netProfit: balance + staked - START_BALANCE,
  };
}
