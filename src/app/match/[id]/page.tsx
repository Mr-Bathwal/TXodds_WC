"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useFixture } from "@/lib/hooks";
import { StatusBadge } from "@/components/match/StatusBadge";
import { VerifyBadge } from "@/components/match/VerifyBadge";
import { PredictPanel } from "@/components/predict/PredictPanel";
import { GoalThread } from "@/components/match/GoalThread";
import { MomentumChart } from "@/components/match/MomentumChart";
import { StatsPanel } from "@/components/match/StatsPanel";
import { WinProbability } from "@/components/match/WinProbability";
import { LineupPitch } from "@/components/match/LineupPitch";
import { HeadToHead } from "@/components/match/HeadToHead";
import { LiveEventFeed } from "@/components/match/LiveEventFeed";
import { Flag } from "@/components/match/Flag";
import { cn } from "@/lib/utils";

/** Hairline divider between open sections. */
function Rule() {
  return <div className="rule my-14" />;
}

export default function MatchDetail() {
  const params = useParams<{ id: string }>();
  const { fixture, isLoading } = useFixture(params.id, 5000);

  if (isLoading)
    return <p className="mx-auto max-w-4xl px-4 pt-28 text-muted">Loading match…</p>;
  if (!fixture)
    return <p className="mx-auto max-w-4xl px-4 pt-28 text-muted">Match not found.</p>;

  const showScore = fixture.status !== "scheduled";
  const isLive = fixture.status === "live" || fixture.status === "halftime";

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-28 pt-24">
      <div className="flex items-center justify-between">
        <Link href="/matches" className="text-sm text-muted transition-colors hover:text-foreground">
          ← All matches
        </Link>
        {fixture.verification && <VerifyBadge verification={fixture.verification} />}
      </div>

      {/* ================= SCOREBOARD — open, no box ================= */}
      <section className="relative mt-10 text-center">
        {/* ambient stadium glow */}
        <div className="pointer-events-none absolute -inset-x-20 -top-24 bottom-0 -z-10 bg-[radial-gradient(55%_65%_at_50%_30%,rgba(26,209,122,0.10),transparent_70%)]" />

        <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.25em] text-muted">
          <span>{fixture.stage}</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <StatusBadge fixture={fixture} className="tracking-normal" />
        </div>

        {/* real match context from the TxLINE feed */}
        {fixture.live?.meta && (fixture.live.meta.weather || fixture.live.meta.pitch || fixture.live.meta.venue) && (
          <div className="mb-6 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted">
            {fixture.live.meta.venue && <span className="rounded-full border border-border px-2 py-0.5 capitalize">{fixture.live.meta.venue} venue</span>}
            {fixture.live.meta.weather && <span className="rounded-full border border-border px-2 py-0.5">☁ {fixture.live.meta.weather}</span>}
            {fixture.live.meta.pitch && <span className="rounded-full border border-border px-2 py-0.5">🌱 pitch {fixture.live.meta.pitch}</span>}
          </div>
        )}

        <div className="flex items-center justify-center gap-8 sm:gap-14">
          <div className="flex flex-1 flex-col items-end gap-3">
            <Flag iso={fixture.home.iso} code={fixture.home.code} className="h-12 w-[64px] sm:h-14 sm:w-[76px]" />
            <div className="text-display text-xl font-bold sm:text-2xl">{fixture.home.name}</div>
          </div>
          <div className="text-display text-7xl font-extrabold tabular-nums sm:text-8xl">
            {showScore ? (
              <>
                <span className={fixture.homeScore >= fixture.awayScore ? "" : "text-muted/60"}>
                  {fixture.homeScore}
                </span>
                <span className="px-2 text-muted/40 sm:px-3">:</span>
                <span className={fixture.awayScore >= fixture.homeScore ? "" : "text-muted/60"}>
                  {fixture.awayScore}
                </span>
              </>
            ) : (
              <span className="text-3xl text-muted">vs</span>
            )}
          </div>
          <div className="flex flex-1 flex-col items-start gap-3">
            <Flag iso={fixture.away.iso} code={fixture.away.code} className="h-12 w-[64px] sm:h-14 sm:w-[76px]" />
            <div className="text-display text-xl font-bold sm:text-2xl">{fixture.away.name}</div>
          </div>
        </div>

        {/* live progress under the score */}
        {isLive && fixture.minute !== null && (
          <div className="mx-auto mt-8 max-w-md">
            <div className="h-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-1000"
                style={{ width: `${(fixture.minute / 90) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* the goal thread grows out of the scoreboard */}
        <GoalThread fixture={fixture} />
      </section>

      <Rule />

      {/* ================= WIN PROBABILITY ================= */}
      <WinProbability fixture={fixture} />

      {showScore && (
        <>
          <Rule />
          <MomentumChart fixture={fixture} />
        </>
      )}

      <Rule />

      {/* ================= PREDICT ================= */}
      <PredictPanel fixture={fixture} />

      {showScore && (
        <>
          <Rule />
          <div className="grid items-start gap-x-12 gap-y-10 lg:grid-cols-[1.15fr_1fr]">
            <StatsPanel fixture={fixture} />
            {fixture.live?.events && fixture.live.events.length > 0 && (
              <LiveEventFeed fixture={fixture} />
            )}
          </div>
        </>
      )}

      <Rule />

      {/* ================= LINEUPS — wide 3D pitch centrepiece ================= */}
      <div className="lg:-mx-16 xl:-mx-32">
        <LineupPitch fixture={fixture} />
      </div>

      <Rule />

      {/* ================= HEAD TO HEAD ================= */}
      <div className="lg:-mx-16 xl:-mx-32">
        <HeadToHead fixture={fixture} />
      </div>
    </div>
  );
}
