"use client";

import type { Fixture } from "@/lib/txline";
import { cn } from "@/lib/utils";

/**
 * Goal thread — the match story told on one open line. A 0–90' thread runs
 * out of the scoreboard; every goal hangs off it on a thin thread with a small
 * "cloud" chip (⚽ minute + team). Home goals float above the line, away goals
 * below. The played portion glows and a pulsing dot marks the live minute.
 */
export function GoalThread({ fixture }: { fixture: Fixture }) {
  if (fixture.status === "scheduled") return null;

  const minute = fixture.minute ?? 0;
  const isLive = fixture.status === "live" || fixture.status === "halftime";
  const pct = (m: number) => `${(Math.min(m, 90) / 90) * 100}%`;
  const goals = fixture.events.filter((e) => e.type === "goal");

  return (
    <div className="relative mx-auto mt-4 h-32 w-full max-w-3xl px-2">
      {/* base thread */}
      <div className="absolute inset-x-2 top-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      {/* played progress */}
      <div
        className="absolute left-2 top-1/2 h-[2px] -translate-y-px rounded-full bg-gradient-to-r from-pitch/10 via-pitch/60 to-pitch"
        style={{ width: `calc(${pct(minute)} - 0.5rem)` }}
      />
      {/* half-time tick */}
      <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-y-1/2 bg-border" />

      {/* live pulse */}
      {isLive && (
        <span
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: pct(minute) }}
        >
          <span className="live-dot block h-2.5 w-2.5 rounded-full bg-pitch shadow-[0_0_12px_var(--pitch)]" />
        </span>
      )}

      {/* goal clouds */}
      {goals.map((g, i) => {
        const home = g.team === "home";
        return (
          <div
            key={i}
            className={cn(
              "absolute flex w-max -translate-x-1/2 flex-col items-center",
              home ? "top-1 bottom-1/2" : "top-1/2 bottom-1",
            )}
            style={{ left: pct(g.minute) }}
          >
            {home && <GoalCloud minute={g.minute} code={fixture.home.code} tone="pitch" />}
            <div
              className={cn(
                "w-px flex-1",
                home
                  ? "bg-gradient-to-b from-pitch/70 to-transparent"
                  : "bg-gradient-to-t from-sol-purple/70 to-transparent",
              )}
            />
            {!home && <GoalCloud minute={g.minute} code={fixture.away.code} tone="purple" />}
          </div>
        );
      })}

      {/* axis labels */}
      <div className="absolute inset-x-2 bottom-0 flex justify-between font-mono text-[10px] text-muted">
        <span>0&rsquo;</span>
        <span className="-translate-x-1/2">HT</span>
        <span>90&rsquo;</span>
      </div>
    </div>
  );
}

function GoalCloud({
  minute,
  code,
  tone,
}: {
  minute: number;
  code: string;
  tone: "pitch" | "purple";
}) {
  return (
    <div
      className={cn(
        "glass flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px]",
        tone === "pitch" ? "shadow-[0_0_14px_rgba(26,209,122,0.25)]" : "shadow-[0_0_14px_rgba(153,69,255,0.3)]",
      )}
    >
      <span aria-hidden>⚽</span>
      <span className="font-mono text-muted">{minute}&rsquo;</span>
      <span className={cn("font-semibold", tone === "pitch" ? "text-pitch" : "text-sol-purple")}>
        {code}
      </span>
    </div>
  );
}
