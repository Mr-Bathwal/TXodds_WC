"use client";

import Link from "next/link";
import { pickLabel } from "@/lib/solana/commitment";
import type { Prediction } from "@/lib/predictions";
import { cn, shortAddress } from "@/lib/utils";

const STATUS_TONE: Record<Prediction["status"], string> = {
  pending: "text-accent",
  won: "text-pitch",
  lost: "text-danger",
  void: "text-muted",
};

/**
 * Predictions ledger — open rows split by hairlines (no card chrome).
 * Each row: match + pick on the left, on-chain proof in the middle,
 * settlement status set big on the right.
 */
export function PredictionsList({ predictions }: { predictions: Prediction[] }) {
  if (predictions.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted">
        No predictions yet.{" "}
        <Link href="/matches" className="text-pitch hover:underline">
          Pick a match →
        </Link>{" "}
        Your call is anchored on Solana the moment you lock it in.
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/40">
      {predictions.map((p) => {
        const [homeCode, , awayCode] = p.matchLabel.split(" ");
        return (
          <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 sm:grid-cols-[1.4fr_1fr_auto]">
            {/* match + pick */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{p.matchLabel}</span>
                {p.simulated && (
                  <span className="text-[10px] uppercase tracking-wider text-muted/70">devnet</span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                {pickLabel(p.pick, homeCode, awayCode)} · odds {p.oddsAtCommit.toFixed(2)} ·{" "}
                {new Date(p.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </div>
            </div>

            {/* on-chain proof */}
            <a
              href={p.explorer}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 font-mono text-xs text-sol-purple transition-colors hover:text-sol-teal sm:flex"
              title="View on-chain anchor"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              {shortAddress(p.signature, 5)} ↗
            </a>

            {/* status */}
            <div className={cn("text-right font-mono text-sm font-semibold uppercase tracking-wider", STATUS_TONE[p.status])}>
              {p.status === "won" ? `won +${p.points}` : p.status}
            </div>
          </div>
        );
      })}
    </div>
  );
}
