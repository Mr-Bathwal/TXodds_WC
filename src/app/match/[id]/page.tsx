"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useFixture } from "@/lib/hooks";
import { StatusBadge } from "@/components/match/StatusBadge";
import { OddsBar } from "@/components/match/OddsBar";
import { VerifyBadge } from "@/components/match/VerifyBadge";
import { PredictPanel } from "@/components/predict/PredictPanel";
import { Flag } from "@/components/match/Flag";
import type { MatchEvent } from "@/lib/txline";

function EventRow({ event, homeName, awayName }: { event: MatchEvent; homeName: string; awayName: string }) {
  const label =
    event.type === "goal"
      ? `⚽ Goal — ${event.team === "home" ? homeName : awayName}`
      : event.type === "kickoff"
        ? "Kick-off"
        : event.type === "halftime"
          ? "Half-time"
          : event.type === "fulltime"
            ? "Full-time"
            : event.type;
  return (
    <div className="flex items-center gap-3 py-1.5 text-sm">
      <span className="w-8 shrink-0 font-mono text-muted tabular-nums">
        {event.minute > 0 ? `${event.minute}'` : "—"}
      </span>
      <span className={event.type === "goal" ? "font-medium text-foreground" : "text-muted"}>
        {label}
      </span>
    </div>
  );
}

export default function MatchDetail() {
  const params = useParams<{ id: string }>();
  const { fixture, isLoading } = useFixture(params.id);

  if (isLoading)
    return <p className="mx-auto max-w-3xl px-4 pt-28 text-muted">Loading match…</p>;
  if (!fixture)
    return <p className="mx-auto max-w-3xl px-4 pt-28 text-muted">Match not found.</p>;

  const showScore = fixture.status !== "scheduled";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-24">
      <Link href="/matches" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← All matches
      </Link>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between text-xs text-muted">
          <span>{fixture.stage} · {fixture.venue}</span>
          <StatusBadge fixture={fixture} />
        </div>

        <div className="flex items-center justify-center gap-6 py-4">
          <div className="flex flex-1 flex-col items-end gap-2">
            <Flag iso={fixture.home.iso} code={fixture.home.code} className="h-10 w-[54px]" />
            <div className="font-semibold">{fixture.home.name}</div>
          </div>
          <div className="font-mono text-4xl tabular-nums">
            {showScore ? `${fixture.homeScore} : ${fixture.awayScore}` : "vs"}
          </div>
          <div className="flex flex-1 flex-col items-start gap-2">
            <Flag iso={fixture.away.iso} code={fixture.away.code} className="h-10 w-[54px]" />
            <div className="font-semibold">{fixture.away.name}</div>
          </div>
        </div>

        <div className="mx-auto mt-2 max-w-sm">
          <OddsBar odds={fixture.odds} />
        </div>

        {fixture.verification && (
          <div className="mt-5 flex items-center justify-center">
            <VerifyBadge verification={fixture.verification} />
          </div>
        )}
      </div>

      <div className="mt-6">
        <PredictPanel fixture={fixture} />
      </div>

      {fixture.events.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
            Timeline
          </h2>
          <div className="divide-y divide-border/50">
            {fixture.events.map((e, i) => (
              <EventRow key={i} event={e} homeName={fixture.home.name} awayName={fixture.away.name} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
