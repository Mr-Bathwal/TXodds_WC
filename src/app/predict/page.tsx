"use client";

import { usePredictions } from "@/lib/usePredictions";
import { useFixtures } from "@/lib/hooks";
import { IdentityBar } from "@/components/predict/IdentityBar";
import { PredictionsList } from "@/components/predict/PredictionsList";
import { MatchCard } from "@/components/match/MatchCard";

export default function PredictPage() {
  const { predictions, stats } = usePredictions();
  const { data } = useFixtures();
  const open = (data?.fixtures ?? []).filter((f) => f.status !== "finished");

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 pb-24 pt-24">
      <div>
        <h1 className="mb-1 text-2xl font-bold tracking-tight">Predict &amp; Prove</h1>
        <p className="text-sm text-muted">
          Every call is hashed and timestamped on Solana before kickoff. Provably fair, auto-settled
          against verified TxLINE results.
        </p>
      </div>

      <IdentityBar stats={stats} />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Open matches
        </h2>
        {open.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {open.map((f) => (
              <MatchCard key={f.id} fixture={f} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No open matches right now — check back soon.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Your predictions
        </h2>
        <PredictionsList predictions={predictions} />
      </section>
    </div>
  );
}
