"use client";

import { useMemo } from "react";
import type { Fixture } from "@/lib/txline";
import { computeMomentum } from "@/lib/matchStats";

/**
 * Match momentum chart (FotMob-style): per-minute pressure bars mirrored
 * around a centre axis — home surges rise, away surges dip. Goals get a dot
 * marker. Pure SVG, colored via CSS variables so it follows the active theme.
 */
export function MomentumChart({ fixture }: { fixture: Fixture }) {
  const points = useMemo(() => computeMomentum(fixture), [fixture]);
  if (points.length < 3) return null;

  const W = 640;
  const H = 140;
  const mid = H / 2;
  const barW = W / 90;

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Momentum</h2>
        <div className="flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-pitch" /> {fixture.home.code}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-sol-purple" /> {fixture.away.code}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Match momentum by minute">
        {/* centre axis + half-time mark */}
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--border)" strokeWidth="1" />
        <line x1={barW * 45} y1="6" x2={barW * 45} y2={H - 6} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" />

        {points.map((p) => {
          const x = (p.minute - 1) * barW;
          const h = Math.abs(p.value) * (mid - 10);
          const isHome = p.value >= 0;
          return (
            <rect
              key={p.minute}
              x={x + 0.5}
              y={isHome ? mid - h : mid}
              width={Math.max(barW - 1.2, 2)}
              height={Math.max(h, 1)}
              rx="1.5"
              fill={isHome ? "var(--pitch)" : "var(--sol-purple)"}
              opacity={0.30 + Math.abs(p.value) * 0.65}
            />
          );
        })}

        {/* goal markers */}
        {points
          .filter((p) => p.goal)
          .map((p) => {
            const x = (p.minute - 1) * barW + barW / 2;
            const y = p.goal === "home" ? 12 : H - 12;
            return (
              <g key={`g${p.minute}`}>
                <circle cx={x} cy={y} r="7" fill="var(--background)" stroke="var(--accent)" strokeWidth="1.5" />
                <text x={x} y={y + 3} textAnchor="middle" fontSize="9" fill="var(--accent)">⚽</text>
              </g>
            );
          })}
      </svg>

      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
        <span>1&rsquo;</span>
        <span>HT</span>
        <span>90&rsquo;</span>
      </div>
    </div>
  );
}
