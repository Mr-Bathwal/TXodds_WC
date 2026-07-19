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
import { Box } from "@/components/ui/Box";
import { cn } from "@/lib/utils";

export default function MatchDetail() {
  const params = useParams<{ id: string }>();
  const { fixture, isLoading } = useFixture(params.id, 5000);

  if (isLoading)
    return <p className="mx-auto max-w-5xl px-4 pt-28 text-center text-muted">Loading match…</p>;
  if (!fixture)
    return <p className="mx-auto max-w-5xl px-4 pt-28 text-center text-muted">Match not found.</p>;

  const showScore = fixture.status !== "scheduled";
  const isLive = fixture.status === "live" || fixture.status === "halftime";

  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-28 pt-24">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/matches" className="text-sm text-muted transition-colors hover:text-foreground">
          ← All matches
        </Link>
        {fixture.verification && <VerifyBadge verification={fixture.verification} />}
      </div>

      <div className="flex flex-col gap-6">
        {/* ================= ROW 1: SCOREBOARD & PREDICT ================= */}
        <div className="grid items-stretch gap-6 lg:grid-cols-2">
          {/* SCOREBOARD */}
          <Box className="relative flex flex-col items-center justify-center text-center">
            {/* ambient stadium glow */}
            <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
              <div className="absolute -inset-x-20 -top-24 bottom-0 bg-[radial-gradient(55%_65%_at_50%_30%,rgba(26,209,122,0.10),transparent_70%)]" />
            </div>

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

            <div className="flex w-full items-center justify-center gap-4 sm:gap-14">
              <div className="flex flex-1 flex-col items-end gap-3">
                <Flag iso={fixture.home.iso} code={fixture.home.code} className="h-12 w-[64px] sm:h-14 sm:w-[76px] rounded-sm shadow-md" />
                <div className="text-display text-lg font-bold sm:text-2xl">{fixture.home.name}</div>
              </div>
              <div className="text-display text-5xl font-extrabold tabular-nums sm:text-7xl">
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
                <Flag iso={fixture.away.iso} code={fixture.away.code} className="h-12 w-[64px] sm:h-14 sm:w-[76px] rounded-sm shadow-md" />
                <div className="text-display text-lg font-bold sm:text-2xl">{fixture.away.name}</div>
              </div>
            </div>

            {/* live progress under the score */}
            {isLive && fixture.minute !== null && (
              <div className="mx-auto w-full max-w-md mt-8">
                <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-1000"
                    style={{ width: `${(fixture.minute / 90) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 w-full">
               <GoalThread fixture={fixture} />
            </div>
          </Box>

          {/* PREDICT */}
          <Box className="flex flex-col justify-center">
            <PredictPanel fixture={fixture} />
          </Box>
        </div>

        {/* ================= ROW 2: TIMELINE ================= */}
        <Box>
          <div className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Live Timeline
          </div>
          <LiveEventFeed fixture={fixture} />
        </Box>

        {/* ================= ROW 3 & 4: MOMENTUM, H2H, STATS ================= */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left Column: Momentum & H2H */}
          <div className="flex flex-col gap-6">
            <Box>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                  Momentum
                </div>
                <div className="flex items-center gap-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-pitch" /> {fixture.home.name}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-sol-purple" /> {fixture.away.name}
                  </span>
                </div>
              </div>
              <MomentumChart fixture={fixture} />
            </Box>
            
            <Box>
              <HeadToHead fixture={fixture} />
            </Box>
          </div>

          {/* Right Column: Stats */}
          <Box className="h-full">
            <StatsPanel fixture={fixture} />
          </Box>
        </div>

        {/* ================= ROW 5: LINEUP ================= */}
        <div className="mx-auto h-[380px] w-full max-w-[650px] mb-12">
          <LineupPitch fixture={fixture} />
        </div>
      </div>
    </div>
  );
}
