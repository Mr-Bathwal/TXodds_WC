"use client";

import { useMemo } from "react";
import type { Fixture } from "@/lib/txline";
import { computeH2H } from "@/lib/lineups";
import { Flag } from "./Flag";
import { cn } from "@/lib/utils";

/**
 * Head to head — open ledger, no card chrome. Aggregate record bar up top,
 * then each past meeting as a wide row separated by hairlines, scores set in
 * big mono numerals with the winner highlighted.
 */
export function HeadToHead({ fixture }: { fixture: Fixture }) {
  const h2h = useMemo(() => computeH2H(fixture), [fixture]);
  const total = h2h.homeWins + h2h.draws + h2h.awayWins || 1;

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
          Head to head
        </h2>
        <span className="font-mono text-xs text-muted">last {h2h.meetings.length} meetings</span>
      </div>

      {/* aggregate record */}
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2.5">
          <Flag iso={fixture.home.iso} code={fixture.home.code} className="h-4 w-6" />
          <span className="font-mono text-2xl font-bold text-pitch tabular-nums">{h2h.homeWins}</span>
          <span className="text-xs uppercase tracking-wider text-muted">wins</span>
        </span>
        <span className="flex items-center gap-2 text-muted">
          <span className="font-mono text-xl tabular-nums">{h2h.draws}</span>
          <span className="text-xs uppercase tracking-wider">draws</span>
        </span>
        <span className="flex items-center gap-2.5">
          <span className="text-xs uppercase tracking-wider text-muted">wins</span>
          <span className="font-mono text-2xl font-bold text-sol-purple tabular-nums">{h2h.awayWins}</span>
          <Flag iso={fixture.away.iso} code={fixture.away.code} className="h-4 w-6" />
        </span>
      </div>
      <div className="mb-6 flex h-2 overflow-hidden rounded-full">
        <div className="bg-gradient-to-r from-pitch-dim to-pitch" style={{ width: `${(h2h.homeWins / total) * 100}%` }} />
        <div className="bg-muted/30" style={{ width: `${(h2h.draws / total) * 100}%` }} />
        <div className="flex-1 bg-gradient-to-r from-sol-purple/60 to-sol-purple" />
      </div>

      {/* meetings ledger */}
      <div className="divide-y divide-border/40">
        {h2h.meetings.map((m, i) => {
          const homeWon = m.homeScore > m.awayScore;
          const awayWon = m.awayScore > m.homeScore;
          return (
            <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 py-3.5">
              <span className="truncate text-xs text-muted">{m.label}</span>
              <div className="flex items-center gap-3 font-mono tabular-nums">
                <span className={cn("w-12 text-right text-sm", homeWon ? "font-bold" : "text-muted")}>
                  {m.homeCode}
                </span>
                <span className="text-lg font-semibold tracking-wide">
                  {m.homeScore}<span className="px-1 text-muted/60">–</span>{m.awayScore}
                </span>
                <span className={cn("w-12 text-sm", awayWon ? "font-bold" : "text-muted")}>
                  {m.awayCode}
                </span>
              </div>
              <span className="text-right text-[10px] uppercase tracking-wider text-muted/70">
                {homeWon ? `${m.homeCode} won` : awayWon ? `${m.awayCode} won` : "draw"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
