"use client";

import type { Fixture, FeedEvent, FeedKind } from "@/lib/txline";
import { cn } from "@/lib/utils";

/**
 * Live play-by-play — the full TxLINE event stream rendered as a commentary
 * feed. Surfaces every event type the feed emits: goals, shots (with outcome),
 * corners, cards, substitutions, free kicks, penalties, VAR, injuries, and the
 * kickoff / half-time / full-time markers. Newest first.
 */

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

function Row({ e, homeCode, awayCode }: { e: FeedEvent; homeCode: string; awayCode: string }) {
  const m = META[e.kind];
  const system = e.kind === "kickoff" || e.kind === "halftime" || e.kind === "fulltime";
  const teamCode = e.team === "home" ? homeCode : e.team === "away" ? awayCode : null;

  if (system) {
    return (
      <div className="flex items-center gap-3 py-2">
        <span className="w-9 shrink-0 text-center font-mono text-[11px] text-muted">
          {e.minute > 0 ? `${e.minute}'` : "—"}
        </span>
        <span className="flex-1 border-t border-dashed border-border/60" />
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
          {m.icon} {m.label}
        </span>
        <span className="flex-1 border-t border-dashed border-border/60" />
      </div>
    );
  }

  const home = e.team === "home";
  return (
    <div className="group grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
      {/* home side */}
      <div className={cn("text-sm", home ? "text-right" : "opacity-0")}>
        {home && <EventBody m={m} kind={e.kind} detail={e.detail} teamCode={teamCode} />}
      </div>
      <span
        className={cn(
          "flex h-7 w-9 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
          m.accent ? "border-pitch/50 bg-pitch/10 text-pitch" : "border-border bg-surface text-muted",
        )}
      >
        {e.minute}&rsquo;
      </span>
      <div className={cn("text-sm", !home ? "text-left" : "opacity-0")}>
        {!home && <EventBody m={m} kind={e.kind} detail={e.detail} teamCode={teamCode} />}
      </div>
    </div>
  );
}

function EventBody({
  m,
  kind,
  detail,
  teamCode,
}: {
  m: { icon: string; label: string; accent?: boolean };
  kind: FeedKind;
  detail?: string;
  teamCode: string | null;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{m.icon}</span>
      <span className={cn(kind === "goal" || kind === "red" ? "font-semibold" : "font-medium")}>
        {m.label}
        {detail ? ` · ${detail}` : ""}
      </span>
      {teamCode && <span className="text-xs text-muted">{teamCode}</span>}
    </span>
  );
}

export function LiveEventFeed({ fixture }: { fixture: Fixture }) {
  const events = fixture.live?.events;
  if (!events || events.length === 0) return null;
  const ordered = [...events].reverse(); // newest first

  return (
    <section>
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Live feed</h2>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" />
          {events.length} events · TxLINE
        </span>
      </div>
      <div className="max-h-[460px] divide-y divide-border/40 overflow-y-auto pr-1">
        {ordered.map((e, i) => (
          <Row key={i} e={e} homeCode={fixture.home.code} awayCode={fixture.away.code} />
        ))}
      </div>
    </section>
  );
}
