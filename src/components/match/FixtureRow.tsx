"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Fixture } from "@/lib/txline";
import { cn } from "@/lib/utils";
import { Flag } from "./Flag";
import { impliedProb } from "@/lib/format";
import { formatKickoff } from "@/lib/format";

/**
 * Open fixture row — the match list rebuilt as a wide editorial ledger row.
 * A theme-colored spotlight tracks the cursor, flags flare on hover, odds are
 * bookmaker-style chips filled by implied probability, and live matches carry
 * a glowing progress thread along the bottom edge.
 */

function OddsChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "home" | "draw" | "away";
}) {
  const implied = impliedProb(value);
  const color =
    tone === "home" ? "var(--pitch)" : tone === "away" ? "var(--sol-purple)" : "var(--muted)";
  return (
    <span
      className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-1.5 font-mono text-xs tabular-nums ring-1 ring-inset ring-white/8 transition-transform duration-150 hover:scale-105"
      title={`${label} · implied ${implied}%`}
    >
      {/* implied-probability fill */}
      <span
        className="absolute inset-y-0 left-0 opacity-25 transition-all duration-500"
        style={{ width: `${implied}%`, background: color }}
      />
      <span className="relative text-muted">{label}</span>
      <span className="relative font-semibold text-foreground">{value.toFixed(2)}</span>
    </span>
  );
}

function Countdown({ kickoff }: { kickoff: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(kickoff).getTime() - now;
  if (ms <= 0 || ms > 3 * 60 * 60_000)
    return <span className="font-mono text-sm text-muted">{formatKickoff(kickoff)}</span>;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <span className="font-mono text-sm font-semibold text-accent tabular-nums">
      {h > 0 && `${h}:`}
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}

export function FixtureRow({ fixture }: { fixture: Fixture }) {
  const rowRef = useRef<HTMLAnchorElement>(null);
  const isLive = fixture.status === "live" || fixture.status === "halftime";
  const showScore = fixture.status !== "scheduled";
  const homeLeads = fixture.homeScore > fixture.awayScore;
  const awayLeads = fixture.awayScore > fixture.homeScore;

  function onMove(e: React.MouseEvent) {
    const el = rowRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <Link
      ref={rowRef}
      href={`/match/${fixture.id}`}
      onMouseMove={onMove}
      className="spot-row group block px-2 py-5 transition-colors sm:px-4"
    >
      {/* line 1 — teams + score */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
        <div className="flex items-center justify-end gap-3 min-w-0">
          <span
            className={cn(
              "truncate text-base sm:text-lg transition-colors",
              homeLeads ? "font-bold" : "font-medium",
              "group-hover:text-pitch",
            )}
          >
            {fixture.home.name}
          </span>
          <Flag
            iso={fixture.home.iso}
            code={fixture.home.code}
            className="h-6 w-9 shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:ring-pitch/60 group-hover:shadow-[0_0_18px_rgba(26,209,122,0.35)]"
          />
        </div>

        <div className="min-w-24 text-center">
          {showScore ? (
            <div className="font-mono text-3xl font-bold tabular-nums sm:text-4xl">
              <span className={homeLeads ? "" : awayLeads ? "text-muted/60" : ""}>
                {fixture.homeScore}
              </span>
              <span className="px-1.5 text-muted/40">–</span>
              <span className={awayLeads ? "" : homeLeads ? "text-muted/60" : ""}>
                {fixture.awayScore}
              </span>
            </div>
          ) : (
            <Countdown kickoff={fixture.kickoff} />
          )}
          <div className="mt-0.5 text-[11px] uppercase tracking-wider">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-pitch">
                <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" />
                {fixture.status === "halftime" ? "HT" : `${fixture.minute}'`}
              </span>
            ) : fixture.status === "finished" ? (
              <span className="text-muted">Full time</span>
            ) : (
              <span className="text-muted">kick-off</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 min-w-0">
          <Flag
            iso={fixture.away.iso}
            code={fixture.away.code}
            className="h-6 w-9 shrink-0 transition-all duration-200 group-hover:scale-110 group-hover:ring-sol-purple/60 group-hover:shadow-[0_0_18px_rgba(153,69,255,0.4)]"
          />
          <span
            className={cn(
              "truncate text-base sm:text-lg transition-colors",
              awayLeads ? "font-bold" : "font-medium",
              "group-hover:text-sol-purple",
            )}
          >
            {fixture.away.name}
          </span>
        </div>
      </div>

      {/* line 2 — meta + odds */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-xs text-muted">
          <span aria-hidden>⚽</span>
          {fixture.stage} · {fixture.venue.split(",")[0]}
          {fixture.verification && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-sol-teal" aria-label="verified on-chain">
              <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <div className="flex items-center gap-2">
          <OddsChip label="1" value={fixture.odds.home} tone="home" />
          <OddsChip label="X" value={fixture.odds.draw} tone="draw" />
          <OddsChip label="2" value={fixture.odds.away} tone="away" />
          <span className="ml-1 hidden text-xs text-pitch opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 sm:inline">
            →
          </span>
        </div>
      </div>

      {/* live progress thread on the bottom edge */}
      {isLive && fixture.minute !== null && (
        <div className="mt-4 h-px w-full bg-surface-2">
          <div
            className="h-px bg-gradient-to-r from-pitch-dim to-pitch shadow-[0_0_8px_var(--pitch)] transition-all duration-1000"
            style={{ width: `${(fixture.minute / 90) * 100}%` }}
          />
        </div>
      )}
    </Link>
  );
}
