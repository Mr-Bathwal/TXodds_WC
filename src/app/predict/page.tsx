"use client";

import { usePredictions } from "@/lib/usePredictions";
import { useFixtures } from "@/lib/hooks";
import { IdentityBar } from "@/components/predict/IdentityBar";
import { PredictionsList } from "@/components/predict/PredictionsList";
import { MatchCard } from "@/components/match/MatchCard";
import { Rule } from "@/components/ui/Rule";

export default function PredictPage() {
  const { predictions, stats } = usePredictions();
  const { data } = useFixtures();
  const open = (data?.fixtures ?? []).filter((f) => f.status !== "finished");

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-28 pt-24">
      {/* ---------- header ---------- */}
      <section className="relative">
        <div className="pointer-events-none absolute -inset-x-20 -top-24 h-64 -z-10 bg-[radial-gradient(55%_80%_at_50%_0%,rgba(153,69,255,0.10),transparent_70%)]" />
        <h1 className="text-display text-4xl font-extrabold sm:text-5xl">
          Predict &amp; <span className="gradient-text">Prove</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
          Every call is hashed and timestamped on Solana before kickoff — provably fair,
          auto-settled against verified TxLINE results.
        </p>
      </section>

      <Rule />

      <IdentityBar stats={stats} />

      <Rule />

      {/* ---------- open matches ---------- */}
      <section>
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            Open matches
          </h2>
          <span className="font-mono text-xs text-muted">{open.length} available</span>
        </div>
        {open.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {open.map((f) => (
              <MatchCard key={f.id} fixture={f} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted">
            No open matches right now — check back soon.
          </p>
        )}
      </section>

      <Rule />

      {/* ---------- prediction ledger ---------- */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            Your predictions
          </h2>
          {predictions.length > 0 && (
            <span className="font-mono text-xs text-muted">
              {predictions.length} on-chain
            </span>
          )}
        </div>
        <PredictionsList predictions={predictions} />
      </section>
    </div>
  );
}
