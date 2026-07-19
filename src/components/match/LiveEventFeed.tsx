"use client";

import type { Fixture, FeedEvent, FeedKind } from "@/lib/txline";
import { cn } from "@/lib/utils";
import { useState } from "react";

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
  const events = fixture.live?.events;
  if (!events || events.length === 0) return null;

  // Filter out system events like kickoff, halftime, fulltime for the timeline if desired,
  // or keep them. Let's keep them and position them at 0, 45, 90.
  const maxMinute = Math.max(90, ...events.map((e) => e.minute));
  
  // Group events by minute to handle overlaps (stack them vertically if same minute)
  const groupedEvents: Record<number, FeedEvent[]> = {};
  events.forEach((e) => {
    if (!groupedEvents[e.minute]) groupedEvents[e.minute] = [];
    groupedEvents[e.minute].push(e);
  });

  return (
    <section className="flex flex-col h-full justify-center min-h-[180px]">
      <div className="mb-10 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Live Timeline</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" />
          {events.length} events · {fixture.live?.source === "api-football" ? "API-Football" : fixture.live?.source === "synth" ? "estimated" : "TxLINE"}
        </span>
      </div>

      <div className="relative w-full px-4 pt-12 pb-8">
        {/* The timeline axis */}
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-2" />
        <div 
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-1000"
          style={{ width: `${Math.min(100, ((fixture.minute ?? maxMinute) / maxMinute) * 100)}%` }}
        />

        {/* Timeline markers for 0, 45, 90 */}
        {[0, 45, 90].map((m) => (
          <div key={`marker-${m}`} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${(m / maxMinute) * 100}%` }}>
            <div className="h-2 w-0.5 bg-muted/30 mb-8" />
            <span className="text-[10px] text-muted absolute top-8">{m}&#39;</span>
          </div>
        ))}

        {/* Events */}
        {Object.entries(groupedEvents).map(([minuteStr, evs]) => {
          const minute = parseInt(minuteStr, 10);
          const percent = (minute / maxMinute) * 100;
          
          return (
            <div 
              key={minute}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-row items-center gap-0.5 group z-10"
              style={{ left: `${percent}%` }}
            >
              {evs.map((e, i) => {
                const m = META[e.kind];
                const isTop = e.team === "home" || (e.team !== "away" && i % 2 === 0);
                
                return (
                  <div key={i} className="relative cursor-default flex flex-col items-center justify-center">
                    <span 
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full border bg-surface text-[14px] shadow-sm transition-transform hover:scale-125 z-10",
                        m.accent ? "border-pitch text-pitch" : "border-border/50"
                      )}
                    >
                      {m.icon}
                    </span>
                    
                    {/* Tooltip */}
                    <div className={cn(
                      "pointer-events-none absolute opacity-0 transition-opacity group-hover:opacity-100 flex flex-col items-center z-20 w-max max-w-[140px] rounded-lg border border-border/60 bg-surface-3 px-3 py-2 text-[11px] text-foreground shadow-xl",
                      isTop ? "bottom-full mb-2" : "top-full mt-2"
                    )}>
                      <span className="font-semibold">{m.label} {minute}&#39;</span>
                      {e.detail && <span className="text-center truncate w-full text-muted mt-0.5">{e.detail}</span>}
                      {e.team && <span className="text-[10px] text-pitch mt-0.5">{e.team === "home" ? fixture.home.name : fixture.away.name}</span>}
                      
                      {/* Triangle pointer */}
                      <div className={cn(
                        "absolute left-1/2 -ml-1.5 border-[6px] border-transparent",
                        isTop ? "top-full border-t-surface-3" : "bottom-full border-b-surface-3"
                      )} />
                      <div className={cn(
                        "absolute left-1/2 -ml-[7px] border-[7px] border-transparent -z-10",
                        isTop ? "top-full border-t-border/60" : "bottom-full border-b-border/60"
                      )} />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}

