"use client";

import { useFixtures } from "@/lib/hooks";
import { MatchCard } from "@/components/match/MatchCard";
import { Container } from "@/components/layout/Container";
import type { Fixture } from "@/lib/txline";

function Section({ title, fixtures }: { title: string; fixtures: Fixture[] }) {
  if (fixtures.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {fixtures.map((f) => (
          <MatchCard key={f.id} fixture={f} />
        ))}
      </div>
    </section>
  );
}

export default function MatchesPage() {
  const { data, isLoading } = useFixtures();
  const fixtures = data?.fixtures ?? [];

  const live = fixtures.filter((f) => f.status === "live" || f.status === "halftime");
  const upcoming = fixtures.filter((f) => f.status === "scheduled");
  const finished = fixtures.filter((f) => f.status === "finished");

  return (
    <Container>
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-display text-3xl font-bold">Match Center</h1>
          <p className="mt-1 text-sm text-muted">
            Live from the TxLINE feed · {data?.live ? "Live data" : "Demo feed"}
          </p>
        </div>
        {live.length > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-pitch/30 bg-pitch/5 px-3 py-1 text-xs text-pitch">
            <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" />
            {live.length} live
          </span>
        )}
      </div>

      {isLoading && <p className="text-muted">Loading fixtures…</p>}

      <Section title="Live now" fixtures={live} />
      <Section title="Upcoming" fixtures={upcoming} />
      <Section title="Full time" fixtures={finished} />
    </Container>
  );
}
