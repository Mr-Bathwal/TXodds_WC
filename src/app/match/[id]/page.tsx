"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useFixture } from "@/lib/hooks";
import { StatusBadge } from "@/components/match/StatusBadge";
import { OddsBar } from "@/components/match/OddsBar";
import { VerifyBadge } from "@/components/match/VerifyBadge";
import { PredictPanel } from "@/components/predict/PredictPanel";
import { MomentumChart } from "@/components/match/MomentumChart";
import { StatsPanel } from "@/components/match/StatsPanel";
import { WinProbability } from "@/components/match/WinProbability";
import { LineupPitch } from "@/components/match/LineupPitch";
import { HeadToHead } from "@/components/match/HeadToHead";
import { Flag } from "@/components/match/Flag";
import { cn } from "@/lib/utils";
import type { MatchEvent } from "@/lib/txline";

/** Centre-line timeline: home events left, away events right, minute bubbles. */
function Timeline({
  events,
  homeCode,
  awayCode,
}: {
  events: MatchEvent[];
  homeCode: string;
  awayCode: string;
}) {
  const rows = events.filter((e) => e.type !== "kickoff");
  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-5 backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Timeline</h2>
      <div className="relative">
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-pitch/40 via-border to-transparent" />
        <div className="space-y-3">
          {rows.map((e, i) => {
            const isSystem = e.type === "halftime" || e.type === "fulltime";
            if (isSystem) {
              return (
                <div key={i} className="relative flex justify-center">
                  <span className="z-10 rounded-full border border-border bg-surface-2 px-3 py-0.5 text-[11px] uppercase tracking-wider text-muted">
                    {e.type === "halftime" ? "Half-time" : "Full-time"}
                  </span>
                </div>
              );
            }
            const home = e.team === "home";
            return (
              <div key={i} className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className={cn("text-sm", home ? "text-right font-medium" : "text-right text-transparent select-none")}>
                  {home && `⚽ Goal · ${homeCode}`}
                </div>
                <span className="z-10 flex h-7 w-9 items-center justify-center rounded-full border border-pitch/40 bg-surface font-mono text-[11px] text-pitch">
                  {e.minute}&rsquo;
                </span>
                <div className={cn("text-sm", !home ? "font-medium" : "text-transparent select-none")}>
                  {!home && `⚽ Goal · ${awayCode}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
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
  const isLive = fixture.status === "live" || fixture.status === "halftime";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-24">
      <Link href="/matches" className="mb-4 inline-block text-sm text-muted hover:text-foreground">
        ← All matches
      </Link>

      {/* ---------- Scoreboard ---------- */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-surface/80 p-6 backdrop-blur-sm",
          isLive ? "border-pitch/30" : "border-border",
        )}
      >
        {/* ambient glow behind scoreboard */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(26,209,122,0.07),transparent)]" />

        <div className="mb-4 flex items-center justify-between text-xs text-muted">
          <span>{fixture.stage} · {fixture.venue}</span>
          <StatusBadge fixture={fixture} />
        </div>

        <div className="flex items-center justify-center gap-6 py-4">
          <div className="flex flex-1 flex-col items-end gap-2">
            <Flag iso={fixture.home.iso} code={fixture.home.code} className="h-10 w-[54px]" />
            <div className="font-semibold">{fixture.home.name}</div>
          </div>
          <div className="text-display text-5xl font-extrabold tabular-nums">
            {showScore ? (
              <>
                <span className={fixture.homeScore >= fixture.awayScore ? "" : "text-muted"}>
                  {fixture.homeScore}
                </span>
                <span className="px-2 text-muted/50">:</span>
                <span className={fixture.awayScore >= fixture.homeScore ? "" : "text-muted"}>
                  {fixture.awayScore}
                </span>
              </>
            ) : (
              <span className="text-2xl text-muted">vs</span>
            )}
          </div>
          <div className="flex flex-1 flex-col items-start gap-2">
            <Flag iso={fixture.away.iso} code={fixture.away.code} className="h-10 w-[54px]" />
            <div className="font-semibold">{fixture.away.name}</div>
          </div>
        </div>

        {/* live match progress */}
        {isLive && fixture.minute !== null && (
          <div className="mx-auto mt-1 max-w-sm">
            <div className="h-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-1000"
                style={{ width: `${(fixture.minute / 90) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="mx-auto mt-4 max-w-sm">
          <OddsBar odds={fixture.odds} />
        </div>

        {fixture.verification && (
          <div className="mt-5 flex items-center justify-center">
            <VerifyBadge verification={fixture.verification} />
          </div>
        )}
      </div>

      {/* ---------- Win probability (live) ---------- */}
      <div className="mt-5">
        <WinProbability fixture={fixture} />
      </div>

      {/* ---------- Momentum ---------- */}
      {showScore && (
        <div className="mt-5">
          <MomentumChart fixture={fixture} />
        </div>
      )}

      {/* ---------- Predict ---------- */}
      <div className="mt-5">
        <PredictPanel fixture={fixture} />
      </div>

      {/* ---------- Stats + Timeline ---------- */}
      {showScore && (
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <StatsPanel fixture={fixture} />
          <Timeline
            events={fixture.events}
            homeCode={fixture.home.code}
            awayCode={fixture.away.code}
          />
        </div>
      )}

      {/* ---------- Lineups + Head-to-head ---------- */}
      <div className="mt-5 grid items-start gap-5 md:grid-cols-2">
        <LineupPitch fixture={fixture} />
        <HeadToHead fixture={fixture} />
      </div>
    </div>
  );
}
