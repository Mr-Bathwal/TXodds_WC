"use client";

import { useEffect, useState } from "react";
import { usePredictions } from "@/lib/usePredictions";
import { buildLeaderboard, type LeaderRow } from "@/lib/leaderboard";
import { getDisplayName, getIdentity } from "@/lib/solana/identity";
import { Rule } from "@/components/ui/Rule";
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
    <div className="mx-auto w-full max-w-4xl px-5 pb-28 pt-24">
      {/* ---------- header ---------- */}
      <section className="relative">
        <div className="pointer-events-none absolute -inset-x-20 -top-24 h-64 -z-10 bg-[radial-gradient(55%_80%_at_50%_0%,rgba(255,207,92,0.08),transparent_70%)]" />
        <h1 className="text-display text-4xl font-extrabold sm:text-5xl">
          The <span className="gradient-text">table</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
          Odds-weighted points — bold calls earn more. Every score is backed by on-chain proof,
          so no one inflates their rank.
        </p>
      </section>

      <Rule />

      {/* ---------- podium ---------- */}
      <section className="flex items-end justify-center gap-4 sm:gap-8">
        {[rows[1], rows[0], rows[2]].filter(Boolean).map((r) => {
          const first = r.rank === 1;
          const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉";
          return (
            <div key={r.rank} className="flex w-32 flex-col items-center sm:w-44">
              <span className={cn("text-3xl", first && "text-4xl")}>{medal}</span>
              <span
                className={cn(
                  "text-display mt-2 w-full truncate text-center font-bold",
                  first ? "text-xl" : "text-base",
                  r.isUser && "text-pitch",
                )}
              >
                {r.name}
              </span>
              <span className="mt-0.5 font-mono text-sm text-muted tabular-nums">
                {r.points} pts
              </span>
              <div
                className={cn(
                  "mt-3 w-full rounded-t-2xl",
                  first
                    ? "h-28 bg-gradient-to-b from-gold/30 via-gold/10 to-transparent"
                    : "h-16 bg-gradient-to-b from-surface-2 to-transparent",
                )}
              />
            </div>
          );
        })}
      </section>

      {/* ---------- your rank — open band ---------- */}
      {you && (
        <>
          <Rule className="my-10" />
          <section className="grid grid-cols-3 items-end divide-x divide-border/40 text-center">
            <div>
              <div className="text-display text-5xl font-extrabold tabular-nums">#{you.rank}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted">your rank</div>
            </div>
            <div>
              <div className="text-display text-5xl font-extrabold text-pitch tabular-nums">
                {you.points}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted">points</div>
            </div>
            <div>
              <div className="text-display text-5xl font-extrabold tabular-nums">
                {stats.streak > 0 ? `🔥${stats.streak}` : "—"}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted">streak</div>
            </div>
          </section>
          <Rule className="my-10" />
        </>
      )}

      {/* ---------- ledger ---------- */}
      <section>
        <div className="grid grid-cols-[3rem_1fr_5rem_6rem] gap-2 pb-3 text-[11px] uppercase tracking-[0.2em] text-muted">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Acc</span>
          <span className="text-right">Points</span>
        </div>
        <div className="divide-y divide-border/40">
          {rows.slice(0, 20).map((r) => (
            <Row key={`${r.name}-${r.rank}`} row={r} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ row }: { row: LeaderRow }) {
  const medal = row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : null;
  return (
    <div
      className={cn(
        "grid grid-cols-[3rem_1fr_5rem_6rem] items-center gap-2 py-3 text-sm",
        row.isUser && "bg-gradient-to-r from-pitch/10 to-transparent",
      )}
    >
      <span className="font-mono text-muted tabular-nums">{medal ?? row.rank}</span>
      <span className="flex items-center gap-2 truncate">
        <span className={cn("truncate", row.isUser && "font-semibold text-pitch")}>{row.name}</span>
        {row.streak > 0 && <span className="text-xs text-accent">🔥{row.streak}</span>}
        {row.isUser && (
          <span className="text-[10px] uppercase tracking-wider text-pitch/80">you</span>
        )}
      </span>
      <span className="text-right font-mono text-muted tabular-nums">
        {Math.round(row.accuracy * 100)}%
      </span>
      <span className="text-right font-mono text-base font-semibold tabular-nums">{row.points}</span>
    </div>
  );
}
