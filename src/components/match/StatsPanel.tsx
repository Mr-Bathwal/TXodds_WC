"use client";

import { useMemo, useRef, useState } from "react";
import type { Fixture } from "@/lib/txline";
import { computeStats } from "@/lib/matchStats";
import { Flag } from "./Flag";
import { cn } from "@/lib/utils";

/**
 * Match stats — a two-sided duel board. Big flag/name headers anchor each
 * side; hovering a half pulls that whole column forward (the other side dims
 * and blurs), hovering a row lifts it with a spotlight strip. Center icons sit
 * in emblems so the stack reads like a broadcast graphic, not a table.
 */

type Side = "home" | "away" | null;

function Icon({ kind }: { kind: string }) {
  const common = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none" } as const;
  switch (kind) {
    case "possession":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
        </svg>
      );
    case "xg":
      return (
        <svg {...common}>
          <path d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2Z" fill="currentColor" />
        </svg>
      );
    case "shots":
      return (
        <svg {...common}>
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill="currentColor" />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </svg>
      );
    case "corner":
      return (
        <svg {...common}>
          <path d="M6 21V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M6 4c4-2 7 2 12 0v7c-5 2-8-2-12 0" fill="currentColor" opacity="0.9" />
        </svg>
      );
    case "card":
      return (
        <svg {...common}>
          <rect x="7" y="4" width="11" height="16" rx="2" fill="currentColor" transform="rotate(8 12 12)" />
        </svg>
      );
    default:
      return null;
  }
}

interface RowDef {
  icon: string;
  label: string;
  home: number;
  away: number;
  format?: (n: number) => string;
}

function StatRow({
  def,
  side,
  active,
  onEnter,
}: {
  def: RowDef;
  side: Side;
  active: boolean;
  onEnter: () => void;
}) {
  const fmt = def.format ?? ((n: number) => String(n));
  const total = def.home + def.away || 1;
  const homePct = (def.home / total) * 100;
  const homeLeads = def.home > def.away;
  const awayLeads = def.away > def.home;

  return (
    <div
      onMouseEnter={onEnter}
      className={cn(
        "relative px-4 py-4 transition-colors duration-300 sm:px-8",
        active && "bg-gradient-to-r from-pitch/[0.06] via-surface/60 to-sol-purple/[0.06]",
      )}
    >
      <div className="flex items-center justify-between">
        {/* home value */}
        <span
          className={cn(
            "min-w-16 font-mono tabular-nums transition-all duration-300",
            active ? "text-3xl" : "text-xl",
            homeLeads ? "font-bold text-pitch" : "text-foreground/80",
            side === "home" && "scale-110 text-pitch drop-shadow-[0_0_16px_rgba(26,209,122,0.5)]",
            side === "away" && "opacity-30 blur-[1px]",
          )}
        >
          {fmt(def.home)}
        </span>

        {/* centre emblem + label */}
        <span className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300",
              active
                ? "border-pitch/50 bg-pitch/10 text-pitch shadow-[0_0_16px_rgba(26,209,122,0.3)]"
                : "border-border bg-surface-2/70 text-muted",
            )}
          >
            <Icon kind={def.icon} />
          </span>
          <span
            className={cn(
              "text-[11px] uppercase tracking-[0.2em] transition-colors duration-300",
              active ? "text-foreground" : "text-muted",
            )}
          >
            {def.label}
          </span>
        </span>

        {/* away value */}
        <span
          className={cn(
            "min-w-16 text-right font-mono tabular-nums transition-all duration-300",
            active ? "text-3xl" : "text-xl",
            awayLeads ? "font-bold text-sol-purple" : "text-foreground/80",
            side === "away" && "scale-110 text-sol-purple drop-shadow-[0_0_16px_rgba(153,69,255,0.55)]",
            side === "home" && "opacity-30 blur-[1px]",
          )}
        >
          {fmt(def.away)}
        </span>
      </div>

      {/* mirrored bars from centre */}
      <div className="mt-2.5 flex items-center gap-2">
        <div className="flex h-1.5 flex-1 justify-end">
          <div
            className={cn(
              "rounded-full bg-gradient-to-l from-pitch to-pitch-dim transition-all duration-500",
              side === "home" ? "h-2.5 -my-0.5 shadow-[0_0_14px_rgba(26,209,122,0.6)]" : "",
              side === "away" && "opacity-25",
            )}
            style={{ width: `${homePct}%` }}
          />
        </div>
        <span className={cn("h-1.5 w-1.5 rounded-full transition-colors", active ? "bg-foreground/60" : "bg-border")} />
        <div className="flex h-1.5 flex-1">
          <div
            className={cn(
              "rounded-full bg-gradient-to-r from-sol-purple to-sol-purple/50 transition-all duration-500",
              side === "away" ? "h-2.5 -my-0.5 shadow-[0_0_14px_rgba(153,69,255,0.65)]" : "",
              side === "home" && "opacity-25",
            )}
            style={{ width: `${100 - homePct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function StatsPanel({ fixture }: { fixture: Fixture }) {
  const stats = useMemo(() => computeStats(fixture), [fixture]);
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<Side>(null);
  const [row, setRow] = useState<number>(-1);
  if (fixture.status === "scheduled") return null;

  // Full per-side detail (ESPN/API-Football/live) takes precedence; fall back to
  // TxLINE's real cumulative totals (corners/cards) when that's all we have.
  const live = fixture.live;
  const real = fixture.liveStats;
  const rows: RowDef[] = live
    ? [
        { icon: "possession", label: "Possession", home: live.possession.home, away: live.possession.away, format: (n) => `${n}%` },
        { icon: "shots", label: "Shots", home: live.shots.home, away: live.shots.away },
        { icon: "target", label: "On target", home: live.shots.onTargetHome, away: live.shots.onTargetAway },
        { icon: "corner", label: "Corners", home: real?.corners[0] ?? 0, away: real?.corners[1] ?? 0 },
        { icon: "card", label: "Yellow cards", home: real?.yellowCards[0] ?? 0, away: real?.yellowCards[1] ?? 0 },
        ...(live.redCards.home + live.redCards.away > 0
          ? [{ icon: "card", label: "Red cards", home: live.redCards.home, away: live.redCards.away }]
          : []),
        { icon: "shots", label: live.source === "api-football" || live.source === "espn" ? "Fouls" : "Free kicks", home: live.freeKicks.home, away: live.freeKicks.away },
      ]
    : real
    ? [
        { icon: "corner", label: "Corners", home: real.corners[0], away: real.corners[1] },
        { icon: "card", label: "Yellow cards", home: real.yellowCards[0], away: real.yellowCards[1] },
      ]
    : [
        { icon: "possession", label: "Possession", home: stats.possessionHome, away: 100 - stats.possessionHome, format: (n) => `${n}%` },
        { icon: "xg", label: "Expected goals", home: stats.xg[0], away: stats.xg[1], format: (n) => n.toFixed(2) },
        { icon: "shots", label: "Shots", home: stats.shots[0], away: stats.shots[1] },
        { icon: "target", label: "On target", home: stats.onTarget[0], away: stats.onTarget[1] },
        { icon: "corner", label: "Corners", home: stats.corners[0], away: stats.corners[1] },
        { icon: "card", label: "Fouls", home: stats.fouls[0], away: stats.fouls[1] },
      ];

  function onMove(e: React.MouseEvent) {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const x = (e.clientX - r.left) / r.width;
    setSide(x < 0.4 ? "home" : x > 0.6 ? "away" : null);
  }

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={() => {
        setSide(null);
        setRow(-1);
      }}
    >
      <h2 className="mb-8 flex items-center justify-center gap-2 text-center text-xs font-semibold uppercase tracking-[0.3em] text-muted">
        Match stats
        {(live || real) && (
          <span className="flex items-center gap-1 rounded-full border border-pitch/30 bg-pitch/5 px-2 py-0.5 text-[10px] normal-case tracking-normal text-pitch">
            <span className="live-dot h-1 w-1 rounded-full bg-pitch" />
            {live?.source === "espn" ? "real · ESPN" : live?.source === "api-football" ? "real · API-Football" : live?.source === "synth" ? "estimated" : "live · TxLINE"}
          </span>
        )}
      </h2>

      {/* duel header */}
      <div className="mb-6 flex items-center justify-between px-4 sm:px-8">
        <div
          className={cn(
            "flex items-center gap-4 transition-all duration-300",
            side === "home" && "scale-105",
            side === "away" && "opacity-35",
          )}
        >
          <Flag
            iso={fixture.home.iso}
            code={fixture.home.code}
            className={cn(
              "h-9 w-[52px] transition-all duration-300",
              side === "home" && "ring-2 ring-pitch/60 shadow-[0_0_24px_rgba(26,209,122,0.45)]",
            )}
          />
          <span className={cn("text-display text-xl font-bold sm:text-2xl", side === "home" && "text-pitch")}>
            {fixture.home.name}
          </span>
        </div>
        <span className="font-mono text-xs text-muted">vs</span>
        <div
          className={cn(
            "flex items-center gap-4 transition-all duration-300",
            side === "away" && "scale-105",
            side === "home" && "opacity-35",
          )}
        >
          <span className={cn("text-display text-xl font-bold sm:text-2xl", side === "away" && "text-sol-purple")}>
            {fixture.away.name}
          </span>
          <Flag
            iso={fixture.away.iso}
            code={fixture.away.code}
            className={cn(
              "h-9 w-[52px] transition-all duration-300",
              side === "away" && "ring-2 ring-sol-purple/60 shadow-[0_0_24px_rgba(153,69,255,0.5)]",
            )}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/40 bg-surface/20 divide-y divide-border/25">
        {rows.map((def, i) => (
          <StatRow key={def.label} def={def} side={side} active={row === i} onEnter={() => setRow(i)} />
        ))}
      </div>
    </section>
  );
}
