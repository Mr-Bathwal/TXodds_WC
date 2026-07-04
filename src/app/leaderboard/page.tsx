"use client";

import { useEffect, useState } from "react";
import { usePredictions } from "@/lib/usePredictions";
import { buildLeaderboard, type LeaderRow } from "@/lib/leaderboard";
import { getDisplayName, getIdentity } from "@/lib/solana/identity";
import { cn } from "@/lib/utils";

export default function LeaderboardPage() {
  const { stats } = usePredictions();
  const [name, setName] = useState("You");

  useEffect(() => {
    const id = getIdentity();
    setName(getDisplayName() ?? `Player ${id.publicKey.slice(0, 4)}`);
  }, []);

  const rows = buildLeaderboard({
    name,
    points: stats.points,
    accuracy: stats.accuracy,
    streak: stats.streak,
  });
  const you = rows.find((r) => r.isUser);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 pb-24 pt-24">
      <div>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted">
          Ranked by odds-weighted points. Every score is backed by on-chain proof — no inflated
          totals.
        </p>
      </div>

      {/* ---------- Podium ---------- */}
      <div className="flex items-end justify-center gap-3 pt-4">
        {[rows[1], rows[0], rows[2]].filter(Boolean).map((r) => {
          const first = r.rank === 1;
          const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉";
          return (
            <div key={r.rank} className="flex w-28 flex-col items-center sm:w-36">
              <span className="text-2xl">{medal}</span>
              <span className={cn("mt-1 w-full truncate text-center text-sm", r.isUser ? "font-bold text-pitch" : "font-medium")}>
                {r.name}
              </span>
              <span className="font-mono text-xs text-muted tabular-nums">{r.points} pts</span>
              <div
                className={cn(
                  "mt-2 w-full rounded-t-xl border border-b-0",
                  first
                    ? "h-24 border-gold/40 bg-gradient-to-b from-gold/25 to-transparent"
                    : "h-16 border-border bg-gradient-to-b from-surface-2 to-transparent",
                )}
              />
            </div>
          );
        })}
      </div>

      {you && (
        <div className="flex items-center justify-between rounded-2xl border border-pitch/30 bg-pitch/5 p-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted">Your rank</div>
            <div className="text-2xl font-bold">#{you.rank}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-2xl font-bold text-pitch tabular-nums">{you.points}</div>
            <div className="text-xs text-muted">points</div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="grid grid-cols-[3rem_1fr_5rem_5rem] gap-2 border-b border-border px-4 py-2 text-[11px] uppercase tracking-wide text-muted">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Acc</span>
          <span className="text-right">Points</span>
        </div>
        {rows.slice(0, 20).map((r) => (
          <Row key={`${r.name}-${r.rank}`} row={r} />
        ))}
      </div>
    </div>
  );
}

function Row({ row }: { row: LeaderRow }) {
  const medal = row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : null;
  return (
    <div
      className={cn(
        "grid grid-cols-[3rem_1fr_5rem_5rem] items-center gap-2 px-4 py-2.5 text-sm",
        row.isUser ? "bg-pitch/10" : "border-t border-border/50",
      )}
    >
      <span className="font-mono text-muted tabular-nums">{medal ?? row.rank}</span>
      <span className="flex items-center gap-2 truncate">
        <span className={cn("truncate", row.isUser && "font-semibold text-pitch")}>{row.name}</span>
        {row.streak > 0 && <span className="text-xs text-accent">🔥{row.streak}</span>}
        {row.isUser && <span className="rounded bg-pitch/20 px-1.5 text-[10px] text-pitch">you</span>}
      </span>
      <span className="text-right font-mono text-muted tabular-nums">
        {Math.round(row.accuracy * 100)}%
      </span>
      <span className="text-right font-mono font-semibold tabular-nums">{row.points}</span>
    </div>
  );
}
