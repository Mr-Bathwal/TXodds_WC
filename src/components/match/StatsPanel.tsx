"use client";

import { useMemo } from "react";
import type { Fixture } from "@/lib/txline";
import { computeStats } from "@/lib/matchStats";
import { cn } from "@/lib/utils";

/**
 * Match stats — open full-width rows, each led by a small icon so the stack
 * reads at a glance instead of as a wall of bars. Values sit on the outer
 * edges (SofaScore pattern); mirrored bars fill the row underneath.
 */

function Icon({ kind }: { kind: string }) {
  const common = { width: 14, height: 14, viewBox: "0 0 24 24", fill: "none" } as const;
  switch (kind) {
    case "possession": // half-shaded circle
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
        </svg>
      );
    case "xg": // sparkle
      return (
        <svg {...common}>
          <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z" fill="currentColor" />
        </svg>
      );
    case "shots": // bolt
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
        </svg>
      );
    case "target": // concentric target
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </svg>
      );
    case "corner": // corner flag
      return (
        <svg {...common}>
          <path d="M6 21V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 4c4-2 7 2 12 0v7c-5 2-8-2-12 0" fill="currentColor" opacity="0.9" />
        </svg>
      );
    case "card": // booking card
      return (
        <svg {...common}>
          <rect x="7" y="4" width="11" height="16" rx="2" fill="currentColor" transform="rotate(8 12 12)" />
        </svg>
      );
    default:
      return null;
  }
}

function StatRow({
  icon,
  label,
  home,
  away,
  format = (n: number) => String(n),
}: {
  icon: string;
  label: string;
  home: number;
  away: number;
  format?: (n: number) => string;
}) {
  const total = home + away || 1;
  const homePct = (home / total) * 100;
  const homeLeads = home > away;
  const awayLeads = away > home;
  return (
    <div className="py-4">
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "min-w-14 font-mono text-lg tabular-nums",
            homeLeads ? "font-bold text-pitch" : "text-foreground/80",
          )}
        >
          {format(home)}
        </span>
        <span className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted">
          <span className="text-muted/70"><Icon kind={icon} /></span>
          {label}
        </span>
        <span
          className={cn(
            "min-w-14 text-right font-mono text-lg tabular-nums",
            awayLeads ? "font-bold text-sol-purple" : "text-foreground/80",
          )}
        >
          {format(away)}
        </span>
      </div>
      <div className="mt-2 flex h-1.5 gap-1.5">
        <div className="rounded-full bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-700" style={{ width: `${homePct / 2}%`, marginLeft: `${(100 - homePct) / 2}%` }} />
        <div className="flex-1 rounded-full bg-gradient-to-r from-sol-purple to-sol-purple/50 transition-all duration-700" style={{ marginRight: `${homePct / 2}%` }} />
      </div>
    </div>
  );
}

export function StatsPanel({ fixture }: { fixture: Fixture }) {
  const stats = useMemo(() => computeStats(fixture), [fixture]);
  if (fixture.status === "scheduled") return null;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Match stats</h2>
        <span className="font-mono text-xs text-muted">
          {fixture.home.code} · {fixture.away.code}
        </span>
      </div>

      <div className="divide-y divide-border/40">
        <StatRow icon="possession" label="Possession" home={stats.possessionHome} away={100 - stats.possessionHome} format={(n) => `${n}%`} />
        <StatRow icon="xg" label="Expected goals" home={stats.xg[0]} away={stats.xg[1]} format={(n) => n.toFixed(2)} />
        <StatRow icon="shots" label="Shots" home={stats.shots[0]} away={stats.shots[1]} />
        <StatRow icon="target" label="On target" home={stats.onTarget[0]} away={stats.onTarget[1]} />
        <StatRow icon="corner" label="Corners" home={stats.corners[0]} away={stats.corners[1]} />
        <StatRow icon="card" label="Fouls" home={stats.fouls[0]} away={stats.fouls[1]} />
      </div>
    </section>
  );
}
