"use client";

import { useMemo, useRef, useState } from "react";
import type { Fixture } from "@/lib/txline";
import { computeH2H } from "@/lib/lineups";
import { Flag } from "./Flag";
import { cn } from "@/lib/utils";

type Side = "home" | "away" | null;

/**
 * Head to head — same duel-board language as the stats: big flag headers with
 * win tallies, side-hover pulls that team's history forward, row-hover lifts a
 * meeting with a spotlight strip and blows up the scoreline.
 */
export function HeadToHead({ fixture }: { fixture: Fixture }) {
  const h2h = useMemo(() => computeH2H(fixture), [fixture]);
  const ref = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState<Side>(null);
  const [row, setRow] = useState(-1);
  const total = h2h.homeWins + h2h.draws + h2h.awayWins || 1;

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
      <h2 className="mb-8 text-center text-xs font-semibold uppercase tracking-[0.3em] text-muted">
        Head to head <span className="ml-2 font-mono normal-case tracking-normal">· last {h2h.meetings.length}</span>
      </h2>

      {/* duel header with win tallies */}
      <div className="mb-4 flex items-end justify-between px-4 sm:px-8">
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
          <div>
            <div className={cn("text-display text-4xl font-extrabold text-pitch tabular-nums", side === "home" && "drop-shadow-[0_0_18px_rgba(26,209,122,0.5)]")}>
              {h2h.homeWins}
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted">wins</div>
          </div>
        </div>

        <div className={cn("pb-1 text-center transition-opacity duration-300", side && "opacity-35")}>
          <div className="font-mono text-2xl text-muted tabular-nums">{h2h.draws}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">draws</div>
        </div>

        <div
          className={cn(
            "flex items-center gap-4 transition-all duration-300",
            side === "away" && "scale-105",
            side === "home" && "opacity-35",
          )}
        >
          <div className="text-right">
            <div className={cn("text-display text-4xl font-extrabold text-sol-purple tabular-nums", side === "away" && "drop-shadow-[0_0_18px_rgba(153,69,255,0.55)]")}>
              {h2h.awayWins}
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-muted">wins</div>
          </div>
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

      {/* record bar */}
      <div className="mx-4 mb-8 flex h-2 overflow-hidden rounded-full sm:mx-8">
        <div
          className={cn("bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-500", side === "away" && "opacity-25", side === "home" && "shadow-[0_0_14px_rgba(26,209,122,0.6)]")}
          style={{ width: `${(h2h.homeWins / total) * 100}%` }}
        />
        <div className={cn("bg-muted/30 transition-opacity", side && "opacity-40")} style={{ width: `${(h2h.draws / total) * 100}%` }} />
        <div
          className={cn("flex-1 bg-gradient-to-r from-sol-purple/60 to-sol-purple transition-all duration-500", side === "home" && "opacity-25", side === "away" && "shadow-[0_0_14px_rgba(153,69,255,0.65)]")}
        />
      </div>

      {/* meetings */}
      <div className="space-y-1">
        {h2h.meetings.map((m, i) => {
          const homeCurr = m.homeCode === fixture.home.code;
          const currHomeGoals = homeCurr ? m.homeScore : m.awayScore;
          const currAwayGoals = homeCurr ? m.awayScore : m.homeScore;
          const winner: Side | "draw" =
            currHomeGoals > currAwayGoals ? "home" : currHomeGoals < currAwayGoals ? "away" : "draw";
          const active = row === i;
          const dimmed = side && winner !== side && winner !== "draw" ? true : side && winner === "draw";
          return (
            <div
              key={i}
              onMouseEnter={() => setRow(i)}
              className={cn(
                "grid grid-cols-[1fr_auto_1fr] items-center gap-4 rounded-2xl px-4 py-3.5 transition-all duration-300 sm:px-8",
                active && "scale-[1.015] bg-gradient-to-r from-pitch/[0.06] via-surface/60 to-sol-purple/[0.06]",
                dimmed && "opacity-35",
              )}
            >
              <span className={cn("truncate text-xs transition-colors", active ? "text-foreground" : "text-muted")}>
                {m.label}
              </span>
              <div className="flex items-center gap-3 font-mono tabular-nums">
                <span className={cn("w-12 text-right text-sm", m.homeScore >= m.awayScore ? "font-bold" : "text-muted")}>
                  {m.homeCode}
                </span>
                <span
                  className={cn(
                    "rounded-lg px-2.5 py-0.5 font-semibold tracking-wide transition-all duration-300",
                    active ? "bg-surface-2 text-2xl shadow-[0_0_18px_rgba(26,209,122,0.15)]" : "text-lg",
                  )}
                >
                  {m.homeScore}
                  <span className="px-1 text-muted/60">–</span>
                  {m.awayScore}
                </span>
                <span className={cn("w-12 text-sm", m.awayScore >= m.homeScore ? "font-bold" : "text-muted")}>
                  {m.awayCode}
                </span>
              </div>
              <span
                className={cn(
                  "text-right text-[10px] uppercase tracking-wider transition-colors",
                  winner === "home" ? "text-pitch" : winner === "away" ? "text-sol-purple" : "text-muted/70",
                )}
              >
                {winner === "draw" ? "draw" : `${winner === "home" ? fixture.home.code : fixture.away.code} won`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
