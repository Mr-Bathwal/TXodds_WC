"use client";

import { useMemo } from "react";
import type { Fixture } from "@/lib/txline";
import { computeH2H } from "@/lib/lineups";
import { Flag } from "./Flag";

/**
 * Head-to-head history: aggregate record bar plus recent meetings list.
 * Deterministic per team pairing; swaps for the real feed when available.
 */
export function HeadToHead({ fixture }: { fixture: Fixture }) {
  const h2h = useMemo(() => computeH2H(fixture), [fixture]);
  const total = h2h.homeWins + h2h.draws + h2h.awayWins || 1;

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
        Head to head
      </h2>

      {/* aggregate record */}
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 font-semibold">
          <Flag iso={fixture.home.iso} code={fixture.home.code} className="h-3.5 w-5" />
          {h2h.homeWins} wins
        </span>
        <span className="text-muted">{h2h.draws} draws</span>
        <span className="flex items-center gap-2 font-semibold">
          {h2h.awayWins} wins
          <Flag iso={fixture.away.iso} code={fixture.away.code} className="h-3.5 w-5" />
        </span>
      </div>
      <div className="mb-5 flex h-2 overflow-hidden rounded-full">
        <div className="bg-pitch transition-all duration-700" style={{ width: `${(h2h.homeWins / total) * 100}%` }} />
        <div className="bg-muted/40 transition-all duration-700" style={{ width: `${(h2h.draws / total) * 100}%` }} />
        <div className="flex-1 bg-sol-purple" />
      </div>

      {/* recent meetings */}
      <div className="space-y-2">
        {h2h.meetings.map((m, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl bg-surface-2/60 px-3 py-2 text-sm"
          >
            <span className="w-28 truncate text-xs text-muted">{m.label}</span>
            <div className="flex items-center gap-2 font-mono tabular-nums">
              <span className={m.homeScore >= m.awayScore ? "font-semibold" : "text-muted"}>
                {m.homeCode}
              </span>
              <span className="rounded bg-surface px-2 py-0.5 text-xs">
                {m.homeScore} – {m.awayScore}
              </span>
              <span className={m.awayScore >= m.homeScore ? "font-semibold" : "text-muted"}>
                {m.awayCode}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
