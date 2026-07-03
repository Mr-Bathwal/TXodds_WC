import Link from "next/link";
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
        <span className="truncate">{fixture.stage}</span>
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
