"use client";

import { pickLabel } from "@/lib/solana/commitment";
import type { Prediction } from "@/lib/predictions";
import { cn, shortAddress } from "@/lib/utils";

const STATUS_STYLE: Record<Prediction["status"], { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "text-accent border-accent/30 bg-accent/5" },
  won: { label: "Won", cls: "text-pitch border-pitch/30 bg-pitch/5" },
  lost: { label: "Lost", cls: "text-danger border-danger/30 bg-danger/5" },
  void: { label: "Void", cls: "text-muted border-border bg-surface-2" },
};

export function PredictionsList({ predictions }: { predictions: Prediction[] }) {
  if (predictions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        No predictions yet. Pick a match and lock in your first call — it&rsquo;ll be anchored on
        Solana instantly.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {predictions.map((p) => {
        const s = STATUS_STYLE[p.status];
        // Author/team names aren't stored per-side; label uses codes in matchLabel.
        const [homeCode, , awayCode] = p.matchLabel.split(" ");
        return (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>{p.matchLabel}</span>
                {p.simulated && (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">devnet</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {pickLabel(p.pick, homeCode, awayCode)} · {p.oddsAtCommit.toFixed(2)} ·{" "}
                <a href={p.explorer} target="_blank" rel="noreferrer" className="text-sol-purple hover:underline">
                  {shortAddress(p.signature, 4)} ↗
                </a>
              </div>
            </div>
            <div className="text-right">
              <span className={cn("rounded-full border px-2 py-0.5 text-xs font-medium", s.cls)}>
                {s.label}
              </span>
              {p.status === "won" && (
                <div className="mt-1 font-mono text-xs text-pitch">+{p.points}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
