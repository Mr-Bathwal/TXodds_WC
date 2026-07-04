"use client";

import { useState } from "react";
import Link from "next/link";
import { useFixtures } from "@/lib/hooks";
import { MatchCard } from "@/components/match/MatchCard";
import { cn } from "@/lib/utils";
import type { Fixture } from "@/lib/txline";

type Filter = "all" | "live" | "upcoming" | "finished";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
];

/** Scrolling strip of compact live scores — the crex/FotMob ticker pattern. */
function LiveTicker({ fixtures }: { fixtures: Fixture[] }) {
  const items = fixtures.filter((f) => f.status !== "scheduled");
  if (items.length === 0) return null;
  const strip = [...items, ...items]; // duplicated for seamless loop
  return (
    <div className="mb-8 overflow-hidden rounded-full border border-border/60 bg-surface/50 py-2 backdrop-blur-sm">
      <div className="flex w-max marquee items-center gap-8 px-4">
        {strip.map((f, i) => (
          <Link
            key={`${f.id}-${i}`}
            href={`/match/${f.id}`}
            className="flex shrink-0 items-center gap-2 font-mono text-xs tabular-nums text-muted transition-colors hover:text-foreground"
          >
            {(f.status === "live" || f.status === "halftime") && (
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" />
            )}
            <span className="font-semibold text-foreground">{f.home.code}</span>
            <span className="text-pitch">{f.homeScore}–{f.awayScore}</span>
            <span className="font-semibold text-foreground">{f.away.code}</span>
            <span className="text-[10px]">
              {f.status === "finished" ? "FT" : f.status === "halftime" ? "HT" : `${f.minute}'`}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

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
  const [filter, setFilter] = useState<Filter>("all");
  const fixtures = data?.fixtures ?? [];

  const live = fixtures.filter((f) => f.status === "live" || f.status === "halftime");
  const upcoming = fixtures.filter((f) => f.status === "scheduled");
  const finished = fixtures.filter((f) => f.status === "finished");

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-3xl font-bold">Match Center</h1>
          <p className="mt-1 text-sm text-muted">
            Live from the TxLINE feed · {data?.live ? "Live data" : "Demo feed"}
          </p>
        </div>
        <div className="flex gap-1 rounded-full border border-border bg-surface/60 p-1 text-sm backdrop-blur-sm">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors",
                filter === f.key
                  ? "bg-pitch font-semibold text-background"
                  : "text-muted hover:text-foreground",
              )}
            >
              {f.label}
              {f.key === "live" && live.length > 0 && (
                <span className={cn("ml-1.5 font-mono text-xs", filter === "live" ? "" : "text-pitch")}>
                  {live.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <LiveTicker fixtures={fixtures} />

      {isLoading && <p className="text-muted">Loading fixtures…</p>}

      {(filter === "all" || filter === "live") && <Section title="Live now" fixtures={live} />}
      {(filter === "all" || filter === "upcoming") && <Section title="Upcoming" fixtures={upcoming} />}
      {(filter === "all" || filter === "finished") && <Section title="Full time" fixtures={finished} />}

      {filter === "live" && live.length === 0 && !isLoading && (
        <p className="py-12 text-center text-sm text-muted">No matches in play right now.</p>
      )}
      {filter === "finished" && finished.length === 0 && !isLoading && (
        <p className="py-12 text-center text-sm text-muted">No finished matches yet today.</p>
      )}
    </div>
  );
}
