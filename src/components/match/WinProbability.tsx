"use client";

import type { Fixture } from "@/lib/txline";
import { impliedProb } from "@/lib/format";

/**
 * Win probability — open band, no card chrome. Big numerals implied live from
 * the TxLINE 1X2 odds, over one wide gradient bar.
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
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
          Win probability
        </h2>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" />
          live · from TxLINE odds
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 items-end">
        <div>
          <div className="text-display text-5xl font-extrabold text-pitch tabular-nums sm:text-6xl">
            {pct.home}<span className="text-2xl">%</span>
          </div>
          <div className="mt-1 text-xs uppercase tracking-wider text-muted">{fixture.home.name}</div>
        </div>
        <div className="text-center">
          <div className="text-display text-3xl font-bold text-muted tabular-nums">
            {pct.draw}<span className="text-lg">%</span>
          </div>
          <div className="mt-1 text-xs uppercase tracking-wider text-muted">Draw</div>
        </div>
        <div className="text-right">
          <div className="text-display text-5xl font-extrabold text-sol-purple tabular-nums sm:text-6xl">
            {pct.away}<span className="text-2xl">%</span>
          </div>
          <div className="mt-1 text-xs uppercase tracking-wider text-muted">{fixture.away.name}</div>
        </div>
      </div>

      <div className="flex h-3 overflow-hidden rounded-full">
        <div className="bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-700" style={{ width: `${pct.home}%` }} />
        <div className="bg-muted/30 transition-all duration-700" style={{ width: `${pct.draw}%` }} />
        <div className="flex-1 bg-gradient-to-r from-sol-purple/60 to-sol-purple transition-all duration-700" />
      </div>
    </section>
  );
}
