"use client";

import type { Fixture, FeedKind } from "@/lib/txline";
import { cn } from "@/lib/utils";

const META: Record<FeedKind, { icon: string; label: string; accent?: boolean }> = {
  goal: { icon: "⚽", label: "Goal", accent: true },
  shot: { icon: "🎯", label: "Shot" },
  corner: { icon: "⛳", label: "Corner" },
  yellow: { icon: "🟨", label: "Yellow card" },
  red: { icon: "🟥", label: "Red card", accent: true },
  sub: { icon: "🔄", label: "Substitution" },
  freekick: { icon: "🅵", label: "Free kick" },
  penalty: { icon: "🥅", label: "Penalty", accent: true },
  var: { icon: "📺", label: "VAR check" },
  injury: { icon: "🩹", label: "Injury" },
  kickoff: { icon: "🟢", label: "Kick-off" },
  halftime: { icon: "⏸", label: "Half-time" },
  fulltime: { icon: "🏁", label: "Full-time" },
};

export function LiveEventFeed({ fixture }: { fixture: Fixture }) {
  // No chips to place (pre-match, or a feed gap mid-match): render the fully-
  // labelled timeline frame (axis + 0'/45'/90' markers) so the box isn't blank.
  if (fixture.status === "scheduled" || !fixture.live?.events?.length) {
    return (
      <section className="flex flex-col h-full justify-center min-h-[180px]">
        <div className="mb-8 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Live Timeline</h2>
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            0 events · {fixture.status === "scheduled" ? "awaiting kick-off" : "no events yet"}
          </span>
        </div>
        <div className="relative w-full px-6" style={{ height: 120 }}>
          <div className="absolute inset-x-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-2" />
          {[0, 45, 90].map((m) => (
            <div key={m} className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center" style={{ left: `${(m / 90) * 100}%` }}>
              <span className="h-2.5 w-px -translate-x-1/2 bg-muted/40" />
              <span className="absolute top-3 -translate-x-1/2 font-mono text-[10px] text-muted">{m}&#39;</span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const events = fixture.live?.events;
  if (!events || events.length === 0) return null;

  // Keep system events (kickoff / half-time / full-time) in the thread; they
  // sit at 0', 45' and 90'.
  const maxMinute = Math.max(90, ...events.map((e) => e.minute));

  // Lift every event off the axis on its own stem so nothing overlaps. Walk the
  // events in time order and alternate above / below the line; within each side
  // stack onto a taller stem whenever the previous marker there is still close
  // (chips are ~6 minutes wide), so neighbours separate vertically instead of
  // colliding. Home goes up, away goes down when a side is free.
  const CHIP_MIN = 6;
  const sorted = events
    .map((e, idx) => ({ e, idx }))
    .sort((a, b) => a.e.minute - b.e.minute || a.idx - b.idx);
  const laneEnds: Record<"top" | "bottom", number[]> = { top: [], bottom: [] };
  const placed = sorted.map(({ e }, i) => {
    const side: "top" | "bottom" = e.team === "away" ? "bottom" : e.team === "home" ? "top" : i % 2 === 0 ? "top" : "bottom";
    const ends = laneEnds[side];
    let lane = ends.findIndex((end) => e.minute - end >= CHIP_MIN);
    if (lane === -1) lane = ends.length;
    ends[lane] = e.minute;
    return { e, side, lane };
  });
  const maxLane = Math.max(0, ...placed.map((p) => p.lane));
  // reserve room for the deepest stem on each side (stem grows 30px per lane)
  const halfHeight = 30 + maxLane * 30 + 34;

  return (
    <section className="flex flex-col h-full justify-center min-h-[180px]">
      <div className="mb-8 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Live Timeline</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" />
          {events.length} events · {fixture.live?.source === "espn" ? "ESPN" : fixture.live?.source === "api-football" ? "API-Football" : fixture.live?.source === "synth" ? "estimated" : "TxLINE"}
        </span>
      </div>

      <div className="relative w-full px-6" style={{ height: halfHeight * 2 }}>
        {/* The timeline axis */}
        <div className="absolute inset-x-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-2" />
        <div
          className="absolute left-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-1000"
          style={{ width: `calc(${Math.min(100, ((fixture.minute ?? 0) / maxMinute) * 100)}% - 1.5rem)` }}
        />

        {/* Timeline markers for 0, 45, 90 */}
        {[0, 45, 90].map((m) => (
          <div key={`marker-${m}`} className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center" style={{ left: `${(m / maxMinute) * 100}%` }}>
            <span className="h-2.5 w-px -translate-x-1/2 bg-muted/40" />
            <span className="absolute top-3 -translate-x-1/2 font-mono text-[10px] text-muted">{m}&#39;</span>
          </div>
        ))}

        {/* Events — each on a leader stem out of the axis */}
        {placed.map(({ e, side, lane }, i) => {
          const m = META[e.kind];
          const percent = (Math.min(e.minute, maxMinute) / maxMinute) * 100;
          const top = side === "top";
          const stem = 14 + lane * 30; // px from axis to the chip
          const edge = percent <= 4 ? "left" : percent >= 96 ? "right" : "center";

          const connector = (
            <span
              className={cn("w-px", m.accent ? "bg-pitch/70" : "bg-border")}
              style={{ height: stem }}
            />
          );
          const chip = (
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full border bg-surface text-[14px] shadow-sm transition-transform group-hover:scale-125",
                m.accent ? "border-pitch text-pitch shadow-[0_0_12px_rgba(26,209,122,0.35)]" : "border-border/60",
              )}
            >
              {m.icon}
            </span>
          );

          return (
            <div
              key={i}
              className={cn(
                "group absolute z-10 flex cursor-default flex-col",
                edge === "left" ? "items-start" : edge === "right" ? "items-end" : "items-center",
                edge === "left" ? "translate-x-0" : edge === "right" ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${percent}%`, ...(top ? { bottom: "50%" } : { top: "50%" }) }}
            >
              {top ? (
                <>
                  {chip}
                  {connector}
                </>
              ) : (
                <>
                  {connector}
                  {chip}
                </>
              )}

              {/* Tooltip */}
              <div
                className={cn(
                  "pointer-events-none absolute left-1/2 z-30 flex w-max max-w-[160px] -translate-x-1/2 flex-col items-center rounded-lg border border-border/60 bg-surface-3 px-3 py-2 text-[11px] text-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100",
                  top ? "bottom-full mb-1.5" : "top-full mt-1.5",
                )}
              >
                <span className="font-semibold">{m.label} {e.minute}&#39;</span>
                {e.detail && <span className="mt-0.5 w-full truncate text-center text-muted">{e.detail}</span>}
                {e.team && <span className="mt-0.5 text-[10px] text-pitch">{e.team === "home" ? fixture.home.name : fixture.away.name}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

