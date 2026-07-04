"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Fixture } from "@/lib/txline";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";
import { OddsBar } from "./OddsBar";
import { VerifyBadge } from "./VerifyBadge";
import { Flag } from "./Flag";
import { Tilt } from "@/components/ui/Tilt";

function TeamRow({
  iso,
  code,
  name,
  score,
  leading,
  showScore,
}: {
  iso: string;
  code: string;
  name: string;
  score: number;
  leading: boolean;
  showScore: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5 min-w-0">
        <Flag iso={iso} code={code} className="h-4 w-[22px]" />
        <span className={cn("truncate", leading ? "font-semibold" : "font-medium")}>{name}</span>
      </div>
      {showScore && (
        <span className={cn("font-mono text-lg tabular-nums", leading ? "text-foreground" : "text-muted")}>
          {score}
        </span>
      )}
    </div>
  );
}

/** Live "kicks off in mm:ss" countdown for scheduled fixtures. */
function Countdown({ kickoff }: { kickoff: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(kickoff).getTime() - now;
  if (ms <= 0 || ms > 3 * 60 * 60_000) return null; // only inside 3h window
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <span className="text-muted">Kicks off in</span>
      <span className="font-mono font-semibold text-accent tabular-nums">
        {h > 0 && `${h}:`}
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </span>
    </div>
  );
}

export function MatchCard({ fixture }: { fixture: Fixture }) {
  const isLiveish = fixture.status === "live" || fixture.status === "halftime";
  const showScore = fixture.status !== "scheduled";
  const homeLeading = fixture.homeScore > fixture.awayScore;
  const awayLeading = fixture.awayScore > fixture.homeScore;

  return (
    <Tilt className="rounded-2xl">
    <Link
      href={`/match/${fixture.id}`}
      className={cn(
        "group block rounded-2xl border bg-surface/80 p-4 backdrop-blur-sm transition-colors hover:border-pitch/40 hover:bg-surface-2",
        isLiveish ? "border-pitch/25" : "border-border",
      )}
    >
      <div className="mb-3 flex items-center justify-between text-xs text-muted">
        <span className="truncate">
          {fixture.stage} · {fixture.venue.split(",")[0]}
        </span>
        <StatusBadge fixture={fixture} />
      </div>

      <div className="space-y-2">
        <TeamRow
          iso={fixture.home.iso}
          code={fixture.home.code}
          name={fixture.home.name}
          score={fixture.homeScore}
          leading={homeLeading}
          showScore={showScore}
        />
        <TeamRow
          iso={fixture.away.iso}
          code={fixture.away.code}
          name={fixture.away.name}
          score={fixture.awayScore}
          leading={awayLeading}
          showScore={showScore}
        />
      </div>

      {/* live match progress under the teams */}
      {isLiveish && fixture.minute !== null && (
        <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-pitch-dim to-pitch transition-all duration-1000"
            style={{ width: `${(fixture.minute / 90) * 100}%` }}
          />
        </div>
      )}

      {fixture.status === "scheduled" && <Countdown kickoff={fixture.kickoff} />}

      <div className="mt-4">
        <OddsBar odds={fixture.odds} />
      </div>

      {fixture.verification && (
        <div className="mt-3 flex items-center justify-between">
          <VerifyBadge verification={fixture.verification} />
          <span className="text-xs text-pitch opacity-0 transition-opacity group-hover:opacity-100">
            Predict →
          </span>
        </div>
      )}
    </Link>
    </Tilt>
  );
}
