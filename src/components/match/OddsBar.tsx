import type { Odds } from "@/lib/txline";
import { formatOdds, impliedProb } from "@/lib/format";
import { cn } from "@/lib/utils";

/** 1X2 odds shown as three segments sized by implied probability. */
export function OddsBar({ odds, className }: { odds: Odds; className?: string }) {
  const probs = {
    home: impliedProb(odds.home),
    draw: impliedProb(odds.draw),
    away: impliedProb(odds.away),
  };
  const total = probs.home + probs.draw + probs.away || 1;

  const segs = [
    { key: "1", value: odds.home, prob: probs.home, color: "bg-pitch" },
    { key: "X", value: odds.draw, prob: probs.draw, color: "bg-muted/50" },
    { key: "2", value: odds.away, prob: probs.away, color: "bg-sol-purple" },
  ];

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        {segs.map((s) => (
          <div
            key={s.key}
            className={cn("h-full", s.color)}
            style={{ width: `${(s.prob / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted font-mono">
        {segs.map((s) => (
          <span key={s.key} className="tabular-nums">
            <span className="text-muted/70">{s.key}</span> {formatOdds(s.value)}
          </span>
        ))}
      </div>
    </div>
  );
}
