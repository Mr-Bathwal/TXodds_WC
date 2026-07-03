"use client";

import { useState } from "react";
import type { Fixture } from "@/lib/txline";
import type { Pick } from "@/lib/solana/commitment";
import { commitPrediction } from "@/lib/commitPrediction";
import { existingPrediction, pointsFor, type Prediction } from "@/lib/predictions";
import { cn, shortAddress } from "@/lib/utils";

type Market = "1x2" | "over_under";
const OU_LINE = 2.5;

function potentialPoints(fixture: Fixture, pick: Pick): number {
  if (pick.market === "1x2") return pointsFor(fixture.odds[pick.value]);
  if (pick.market === "over_under") return pointsFor(1.9);
  return pointsFor(2.5);
}

export function PredictPanel({ fixture }: { fixture: Fixture }) {
  const [market, setMarket] = useState<Market>("1x2");
  const [pick, setPick] = useState<Pick | null>(null);
  const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [committed, setCommitted] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const closed = fixture.status === "finished";
  const existing = existingPrediction(fixture.id, market);

  async function handleCommit() {
    if (!pick) return;
    setStatus("signing");
    setError(null);
    try {
      const result = await commitPrediction(fixture, pick);
      setCommitted(result);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (closed) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 text-center text-sm text-muted">
        Predictions are closed — this match has finished.
      </div>
    );
  }

  const done = status === "done" && committed;

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Predict &amp; Prove</h3>
        <span className="text-xs text-muted">Timestamped on Solana</span>
      </div>

      {done ? (
        <CommittedReceipt prediction={committed!} onReset={() => { setStatus("idle"); setPick(null); setCommitted(null); }} />
      ) : existing ? (
        <ExistingPick prediction={existing} fixture={fixture} />
      ) : (
        <>
          <div className="mb-3 flex gap-1 rounded-full bg-surface-2 p-1 text-sm">
            {(["1x2", "over_under"] as Market[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMarket(m); setPick(null); }}
                className={cn(
                  "flex-1 rounded-full py-1.5 transition-colors",
                  market === m ? "bg-pitch text-background font-semibold" : "text-muted hover:text-foreground",
                )}
              >
                {m === "1x2" ? "Match result" : `Total goals ${OU_LINE}`}
              </button>
            ))}
          </div>

          {market === "1x2" ? (
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: "home", label: fixture.home.code, odds: fixture.odds.home },
                { value: "draw", label: "Draw", odds: fixture.odds.draw },
                { value: "away", label: fixture.away.code, odds: fixture.odds.away },
              ] as const).map((o) => {
                const selected = pick?.market === "1x2" && pick.value === o.value;
                return (
                  <OptionButton
                    key={o.value}
                    label={o.label}
                    odds={o.odds}
                    points={pointsFor(o.odds)}
                    selected={selected}
                    onClick={() => setPick({ market: "1x2", value: o.value })}
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {(["over", "under"] as const).map((v) => {
                const selected = pick?.market === "over_under" && pick.value === v;
                return (
                  <OptionButton
                    key={v}
                    label={`${v === "over" ? "Over" : "Under"} ${OU_LINE}`}
                    odds={1.9}
                    points={pointsFor(1.9)}
                    selected={selected}
                    onClick={() => setPick({ market: "over_under", value: v, line: OU_LINE })}
                  />
                );
              })}
            </div>
          )}

          <button
            disabled={!pick || status === "signing"}
            onClick={handleCommit}
            className={cn(
              "mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-all",
              !pick
                ? "cursor-not-allowed bg-surface-2 text-muted"
                : "bg-gradient-to-r from-sol-purple to-sol-teal text-background hover:opacity-90",
            )}
          >
            {status === "signing"
              ? "Anchoring on Solana…"
              : pick
                ? `Lock in for +${potentialPoints(fixture, pick)} pts`
                : "Choose your call"}
          </button>
          {pick && (
            <p className="mt-2 text-center text-xs text-muted">
              Your pick is hashed &amp; timestamped on-chain before kickoff — no changing it later.
            </p>
          )}
          {error && <p className="mt-2 text-center text-xs text-danger">{error}</p>}
        </>
      )}
    </div>
  );
}

function OptionButton({
  label,
  odds,
  points,
  selected,
  onClick,
}: {
  label: string;
  odds: number;
  points: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center rounded-xl border py-3 transition-all",
        selected
          ? "border-pitch bg-pitch/10"
          : "border-border bg-surface-2 hover:border-pitch/40",
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="mt-0.5 font-mono text-xs text-muted">{odds.toFixed(2)}</span>
      <span className="mt-1 text-[11px] text-pitch">+{points} pts</span>
    </button>
  );
}

function CommittedReceipt({ prediction, onReset }: { prediction: Prediction; onReset: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pitch/15">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-pitch">
          <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="font-semibold">Locked in &amp; anchored on-chain</p>
      <p className="mt-1 text-xs text-muted">
        Your pick is now provably fair — committed {new Date(prediction.createdAt).toLocaleTimeString()}.
      </p>
      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-left font-mono text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-muted">hash</span>
          <span>{shortAddress(prediction.hash, 6)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span className="text-muted">tx</span>
          <span>{shortAddress(prediction.signature, 6)}</span>
        </div>
      </div>
      <a
        href={prediction.explorer}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block rounded-lg bg-sol-purple/15 px-2 py-2 text-sm text-sol-purple hover:bg-sol-purple/25"
      >
        {prediction.simulated ? "View anchor (devnet demo) ↗" : "Verify on Solana Explorer ↗"}
      </a>
      <button onClick={onReset} className="mt-2 text-xs text-muted hover:text-foreground">
        Make another prediction
      </button>
    </div>
  );
}

function ExistingPick({ prediction, fixture }: { prediction: Prediction; fixture: Fixture }) {
  void fixture;
  const tone =
    prediction.status === "won"
      ? "text-pitch"
      : prediction.status === "lost"
        ? "text-danger"
        : "text-accent";
  return (
    <div className="text-center text-sm">
      <p className="text-muted">You&rsquo;ve already called this market.</p>
      <p className={cn("mt-1 font-semibold capitalize", tone)}>
        {prediction.status === "pending" ? "Awaiting result" : prediction.status}
        {prediction.status === "won" && ` · +${prediction.points} pts`}
      </p>
      <a
        href={prediction.explorer}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-xs text-sol-purple hover:underline"
      >
        View on-chain proof ↗
      </a>
    </div>
  );
}
