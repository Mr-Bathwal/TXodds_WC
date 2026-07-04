"use client";

import { useMemo, useRef, useState } from "react";
import type { Fixture } from "@/lib/txline";
import { computeMomentum } from "@/lib/matchStats";
import { cn } from "@/lib/utils";

/**
 * Momentum — full-width open canvas, no card chrome. Per-minute pressure bars
 * mirrored around the axis; hovering sweeps a scrubber that reads out the
 * minute and which side was on top. Goals ride the spikes as glowing markers.
 */
export function MomentumChart({ fixture }: { fixture: Fixture }) {
  const points = useMemo(() => computeMomentum(fixture), [fixture]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  if (points.length < 3) return null;

  const W = 900;
  const H = 230;
  const mid = H / 2;
  const barW = W / 90;

  const hovered = hoverMin ? points.find((p) => p.minute === hoverMin) : undefined;
  const dominance = hovered ? Math.round(Math.abs(hovered.value) * 100) : 0;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const m = Math.round(((e.clientX - rect.left) / rect.width) * 90);
    setHoverMin(Math.max(1, Math.min(90, m)));
  }

  return (
    <section className="relative">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Momentum</h2>
        <div className="flex items-center gap-5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-pitch" /> {fixture.home.name}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-sol-purple" /> {fixture.away.name}
          </span>
        </div>
      </div>

      {/* hover readout */}
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 font-mono text-sm transition-opacity",
          hovered ? "opacity-100" : "opacity-0",
        )}
      >
        {hovered && (
          <span>
            <span className="text-muted">{hovered.minute}&rsquo; · </span>
            <span className={hovered.value >= 0 ? "text-pitch" : "text-sol-purple"}>
              {hovered.value >= 0 ? fixture.home.code : fixture.away.code} {dominance}%
            </span>
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverMin(null)}
        role="img"
        aria-label="Match momentum by minute"
      >
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--border)" strokeWidth="1" />
        <line x1={barW * 45} y1="8" x2={barW * 45} y2={H - 8} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />

        {points.map((p) => {
          const x = (p.minute - 1) * barW;
          const h = Math.abs(p.value) * (mid - 14);
          const isHome = p.value >= 0;
          const isHover = p.minute === hoverMin;
          return (
            <rect
              key={p.minute}
              x={x + 0.6}
              y={isHome ? mid - h : mid}
              width={Math.max(barW - 1.6, 2.5)}
              height={Math.max(h, 1.5)}
              rx="2"
              fill={isHome ? "var(--pitch)" : "var(--sol-purple)"}
              opacity={isHover ? 1 : 0.28 + Math.abs(p.value) * 0.6}
            />
          );
        })}

        {/* hover scrubber */}
        {hoverMin && (
          <line
            x1={(hoverMin - 0.5) * barW}
            y1="4"
            x2={(hoverMin - 0.5) * barW}
            y2={H - 4}
            stroke="var(--foreground)"
            strokeWidth="1"
            opacity="0.35"
          />
        )}

        {/* goal markers */}
        {points
          .filter((p) => p.goal)
          .map((p) => {
            const x = (p.minute - 1) * barW + barW / 2;
            const y = p.goal === "home" ? 16 : H - 16;
            return (
              <g key={`g${p.minute}`}>
                <circle cx={x} cy={y} r="10" fill="var(--background)" stroke="var(--accent)" strokeWidth="1.5" />
                <text x={x} y={y + 4} textAnchor="middle" fontSize="11">⚽</text>
              </g>
            );
          })}
      </svg>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        <span>1&rsquo;</span>
        <span>HT</span>
        <span>90&rsquo;</span>
      </div>
    </section>
  );
}
