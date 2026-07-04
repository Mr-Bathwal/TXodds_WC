"use client";

import { useMemo } from "react";
import type { Fixture } from "@/lib/txline";
import { computeLineup, type PlayerSlot } from "@/lib/lineups";
import { cn } from "@/lib/utils";

/**
 * Formation view (SofaScore-style): a vertical pitch with both starting XIs,
 * home attacking downward from the top, away mirrored from the bottom.
 * Ratings appear once the match is underway; the best player gets a star ring.
 */

const W = 400;
const H = 560;

function ratingTone(r: number): string {
  if (r >= 8) return "var(--sol-teal)";
  if (r >= 7) return "var(--pitch)";
  if (r >= 6.4) return "var(--gold)";
  return "var(--danger)";
}

function PlayerDot({
  p,
  side,
  rows,
}: {
  p: PlayerSlot;
  side: "home" | "away";
  rows: number;
}) {
  // Each team occupies its half; rows spread from goal line toward midfield.
  const depth = (p.row + 0.7) / (rows + 0.9); // 0..1 within the half
  const y = side === "home" ? depth * (H / 2 - 26) + 16 : H - (depth * (H / 2 - 26) + 16);
  const x = (side === "home" ? p.x : 100 - p.x) * (W / 100);
  const fill = side === "home" ? "var(--pitch)" : "var(--sol-purple)";

  return (
    <g>
      {p.star && (
        <circle cx={x} cy={y} r={15} fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="3 3" />
      )}
      <circle cx={x} cy={y} r={11.5} fill={fill} opacity={0.92} />
      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--background)">
        {p.number}
      </text>
      <text x={x} y={y + 26} textAnchor="middle" fontSize="9.5" fill="var(--foreground)" opacity={0.85}>
        {p.name}
      </text>
      {p.rating > 0 && (
        <g>
          <rect x={x + 8} y={y - 22} width={26} height={13} rx={4} fill={ratingTone(p.rating)} />
          <text x={x + 21} y={y - 12} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--background)">
            {p.rating.toFixed(1)}
          </text>
        </g>
      )}
    </g>
  );
}

export function LineupPitch({ fixture }: { fixture: Fixture }) {
  const home = useMemo(() => computeLineup(fixture, "home"), [fixture]);
  const away = useMemo(() => computeLineup(fixture, "away"), [fixture]);
  const predicted = fixture.status === "scheduled";

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          {predicted ? "Predicted lineups" : "Lineups"}
        </h2>
        <div className="flex items-center gap-4 font-mono text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-pitch" />
            {fixture.home.code} {home.formation}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sol-purple" />
            {fixture.away.code} {away.formation}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Team formations">
        {/* pitch */}
        <rect x="4" y="4" width={W - 8} height={H - 8} rx="14" fill="var(--surface-2)" opacity="0.5" />
        <rect x="4" y="4" width={W - 8} height={H - 8} rx="14" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        {/* stripes */}
        {Array.from({ length: 8 }).map((_, i) => (
          <rect key={i} x="4" y={4 + i * ((H - 8) / 8)} width={W - 8} height={(H - 8) / 8}
            fill={i % 2 ? "var(--pitch)" : "transparent"} opacity={0.03} />
        ))}
        {/* halfway + centre circle */}
        <line x1="4" y1={H / 2} x2={W - 4} y2={H / 2} stroke="var(--border)" strokeWidth="1.5" />
        <circle cx={W / 2} cy={H / 2} r="42" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        {/* boxes */}
        <rect x={W / 2 - 70} y="4" width="140" height="46" fill="none" stroke="var(--border)" strokeWidth="1.5" />
        <rect x={W / 2 - 70} y={H - 50} width="140" height="46" fill="none" stroke="var(--border)" strokeWidth="1.5" />

        {home.players.map((p) => (
          <PlayerDot key={`h${p.number}`} p={p} side="home" rows={home.rows} />
        ))}
        {away.players.map((p) => (
          <PlayerDot key={`a${p.number}`} p={p} side="away" rows={away.rows} />
        ))}
      </svg>

      {!predicted && (
        <p className={cn("mt-3 text-center text-[11px] text-muted")}>
          ★ dashed ring = highest-rated player on the pitch
        </p>
      )}
    </div>
  );
}
