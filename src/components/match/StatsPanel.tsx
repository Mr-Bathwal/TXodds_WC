"use client";

import { useMemo } from "react";
import type { Fixture } from "@/lib/txline";
import { computeStats } from "@/lib/matchStats";

/**
 * Head-to-head match statistics: possession donut-bar plus mirrored comparison
 * rows (shots, on target, corners, fouls, xG). Bars are proportional and theme
 * colored; values evolve live with the match clock.
 */

function StatRow({
  label,
  home,
  away,
  format = (n: number) => String(n),
}: {
  label: string;
  home: number;
  away: number;
  format?: (n: number) => string;
}) {
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-sm tabular-nums">
        <span className={home >= away ? "text-foreground" : "text-muted"}>{format(home)}</span>
        <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
        <span className={away >= home ? "text-foreground" : "text-muted"}>{format(away)}</span>
      </div>
      <div className="mt-1.5 flex h-1 gap-1 overflow-hidden">
        <div className="rounded-full bg-pitch transition-all duration-700" style={{ width: `${homePct}%` }} />
        <div className="flex-1 rounded-full bg-sol-purple transition-all duration-700" />
      </div>
    </div>
  );
}

export function StatsPanel({ fixture }: { fixture: Fixture }) {
  const stats = useMemo(() => computeStats(fixture), [fixture]);
  if (fixture.status === "scheduled") return null;

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
        Match stats
      </h2>

      {/* Possession */}
      <div className="mb-5">
        <div className="flex items-center justify-between font-mono text-sm tabular-nums">
          <span className="text-pitch">{stats.possessionHome}%</span>
          <span className="text-[11px] uppercase tracking-wider text-muted">Possession</span>
          <span className="text-sol-purple">{100 - stats.possessionHome}%</span>
        </div>
        <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full">
          <div
            className="bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-700"
            style={{ width: `${stats.possessionHome}%` }}
          />
          <div className="flex-1 bg-gradient-to-r from-sol-purple to-sol-purple/60" />
        </div>
      </div>

      <div className="space-y-4">
        <StatRow label="Expected goals" home={stats.xg[0]} away={stats.xg[1]} format={(n) => n.toFixed(2)} />
        <StatRow label="Shots" home={stats.shots[0]} away={stats.shots[1]} />
        <StatRow label="On target" home={stats.onTarget[0]} away={stats.onTarget[1]} />
        <StatRow label="Corners" home={stats.corners[0]} away={stats.corners[1]} />
        <StatRow label="Fouls" home={stats.fouls[0]} away={stats.fouls[1]} />
      </div>
    </div>
  );
}
