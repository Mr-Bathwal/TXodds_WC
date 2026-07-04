"use client";

import type { Fixture } from "@/lib/txline";
import { impliedProb } from "@/lib/format";

/**
 * Live win probability (SofaScore-style): implied from the current TxLINE 1X2
 * odds, so it shifts in real time with the scoreline and clock. Rendered as a
 * three-segment bar with big percentage readouts.
 */
export function WinProbability({ fixture }: { fixture: Fixture }) {
  const raw = {
    home: impliedProb(fixture.odds.home),
    draw: impliedProb(fixture.odds.draw),
    away: impliedProb(fixture.odds.away),
  };
  const total = raw.home + raw.draw + raw.away || 1;
  const pct = {
    home: Math.round((raw.home / total) * 100),
    draw: Math.round((raw.draw / total) * 100),
    away: 0,
  };
  pct.away = 100 - pct.home - pct.draw;

  if (fixture.status === "finished") return null;

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Win probability
        </h2>
        <span className="text-[11px] text-muted">live · from TxLINE odds</span>
      </div>

      <div className="mb-2 grid grid-cols-3 text-center">
        <div>
          <div className="font-mono text-2xl font-bold text-pitch tabular-nums">{pct.home}%</div>
          <div className="text-xs text-muted">{fixture.home.code}</div>
        </div>
        <div>
          <div className="font-mono text-2xl font-bold text-muted tabular-nums">{pct.draw}%</div>
          <div className="text-xs text-muted">Draw</div>
        </div>
        <div>
          <div className="font-mono text-2xl font-bold text-sol-purple tabular-nums">{pct.away}%</div>
          <div className="text-xs text-muted">{fixture.away.code}</div>
        </div>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div className="bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-700" style={{ width: `${pct.home}%` }} />
        <div className="bg-muted/40 transition-all duration-700" style={{ width: `${pct.draw}%` }} />
        <div className="flex-1 bg-gradient-to-r from-sol-purple/70 to-sol-purple transition-all duration-700" />
      </div>
    </div>
  );
}
