"use client";

import { useState } from "react";
import { usePredictions } from "@/lib/usePredictions";
import { useFixtures } from "@/lib/hooks";
import { IdentityBar } from "@/components/predict/IdentityBar";
import { PredictionsList } from "@/components/predict/PredictionsList";
import { FixtureRow } from "@/components/match/FixtureRow";
import { Rule } from "@/components/ui/Rule";
import { cn } from "@/lib/utils";
import type { Fixture } from "@/lib/txline";

/** One column of the two-lane open-matches grid (live-page pattern). */
function OpenLane({ fixtures }: { fixtures: Fixture[] }) {
  if (fixtures.length === 0) return null;
  return (
    <div className="min-w-0 divide-y divide-border/40 rounded-2xl border border-border/40 p-3 sm:p-4">
      {fixtures.map((f) => (
        <FixtureRow key={f.id} fixture={f} compact />
      ))}
    </div>
  );
}

export default function PredictPage() {
  const { predictions, stats } = usePredictions();
  const { data } = useFixtures();
  const [histOpen, setHistOpen] = useState(false);

  const open = (data?.fixtures ?? []).filter((f) => f.status !== "finished");
  const half = Math.ceil(open.length / 2);
  const colA = open.slice(0, half);
  const colB = open.slice(half);

  return (
    <div className="pb-28">
      {/* ================= FULL-BLEED VIDEO DASHBOARD HERO ================= */}
      <section className="relative flex h-[46svh] min-h-[340px] w-full items-center overflow-hidden">
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-45"
          src="/videos/ball-kick.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
        {/* readability veils */}
        <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/30 to-background/60" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-10">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-1.5 text-xs text-sol-teal backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-sol-teal" />
            Timestamped on Solana · settled by TxLINE
          </div>
          <h1 className="text-display text-5xl font-extrabold sm:text-7xl">
            Predict &amp; <span className="gradient-text">Prove</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm text-foreground/80 sm:text-base">
            Every call is hashed and timestamped on Solana before kickoff — provably fair,
            auto-settled against verified TxLINE results.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-5">
        {/* ================= PLAYER DASHBOARD ================= */}
        <div className="mt-12">
          <IdentityBar stats={stats} />
        </div>

        {/* prediction history — collapsible, right in the dashboard */}
        <div className="mt-10 overflow-hidden rounded-2xl border border-border/40">
          <button
            onClick={() => setHistOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface/60"
          >
            <span className="text-xs font-semibold uppercase tracking-[0.25em] text-muted">
              Prediction history
              <span className="ml-3 font-mono normal-case tracking-normal text-pitch">
                {predictions.length} on-chain
              </span>
            </span>
            <span
              className={cn(
                "text-muted transition-transform duration-300",
                histOpen && "rotate-180 text-pitch",
              )}
              aria-hidden
            >
              ▾
            </span>
          </button>
          <div
            className={cn(
              "grid transition-all duration-500 ease-out",
              histOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="overflow-hidden">
              <div className="border-t border-border/40 px-4 pb-3">
                <PredictionsList predictions={predictions} />
              </div>
            </div>
          </div>
        </div>

        <Rule />

        {/* ================= OPEN MATCHES — two lanes ================= */}
        <section>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
              Open matches
            </h2>
            <span className="font-mono text-xs text-muted">{open.length} available</span>
          </div>
          {open.length ? (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <OpenLane fixtures={colA} />
              <OpenLane fixtures={colB} />
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted">
              No open matches right now — check back soon.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
