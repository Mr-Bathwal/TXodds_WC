"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useFixtures } from "@/lib/hooks";
import { FixtureRow } from "@/components/match/FixtureRow";
import { Rule } from "@/components/ui/Rule";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Fixture } from "@/lib/txline";

const MiniBall = dynamic(() => import("@/components/three/MiniBall"), { ssr: false });

type Filter = "all" | "live" | "upcoming" | "finished";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
];

/** Borderless scrolling score strip. */
function LiveTicker({ fixtures }: { fixtures: Fixture[] }) {
  const items = fixtures.filter((f) => f.status !== "scheduled");
  if (items.length === 0) return null;
  const strip = [...items, ...items];
  return (
    <div className="relative overflow-hidden py-3">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-background to-transparent" />
      <div className="flex w-max marquee items-center gap-10">
        {strip.map((f, i) => (
          <Link
            key={`${f.id}-${i}`}
            href={`/match/${f.id}`}
            className="flex shrink-0 items-center gap-2 font-mono text-xs tabular-nums text-muted transition-colors hover:text-foreground"
          >
            <span aria-hidden className="text-[10px]">⚽</span>
            <span className="font-semibold text-foreground">{f.home.code}</span>
            <span className="text-pitch">{f.homeScore}–{f.awayScore}</span>
            <span className="font-semibold text-foreground">{f.away.code}</span>
            <span className="text-[10px]">
              {f.status === "finished" ? "FT" : f.status === "halftime" ? "HT" : (
                <span className="inline-flex items-center gap-1 text-pitch">
                  <span className="live-dot h-1 w-1 rounded-full bg-pitch" />{f.minute}&rsquo;
                </span>
              )}
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
    <section className="mb-12">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
        {title}
      </h2>
      <div className="divide-y divide-border/40">
        {fixtures.map((f) => (
          <FixtureRow key={f.id} fixture={f} />
        ))}
      </div>
    </section>
  );
}

export default function MatchesPage() {
  const { data, isLoading } = useFixtures();
  const { theme } = useTheme();
  const [filter, setFilter] = useState<Filter>("all");
  const fixtures = data?.fixtures ?? [];

  const live = fixtures.filter((f) => f.status === "live" || f.status === "halftime");
  const upcoming = fixtures.filter((f) => f.status === "scheduled");
  const finished = fixtures.filter((f) => f.status === "finished");

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-28 pt-24">
      {/* ---------- header with interactive 3D ball ---------- */}
      <section className="relative">
        <div className="pointer-events-none absolute -inset-x-20 -top-24 h-72 -z-10 bg-[radial-gradient(55%_80%_at_50%_0%,rgba(26,209,122,0.10),transparent_70%)]" />
        <div className="flex items-center justify-between gap-6">
          <div>
            <h1 className="text-display text-4xl font-extrabold sm:text-5xl">
              Match <span className="gradient-text">Center</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted sm:text-base">
              Every score, every odds move, straight from the TxLINE feed —{" "}
              {data?.live ? "live data" : "demo feed"}.
            </p>
          </div>
          {/* interactive ball — spin it, click to kick */}
          <div className="h-36 w-36 shrink-0 cursor-pointer sm:h-44 sm:w-44" title="Click to kick">
            <MiniBall glow={theme.three.glow} />
          </div>
        </div>
      </section>

      <LiveTicker fixtures={fixtures} />
      <Rule className="my-6" />

      {/* ---------- minimal underline filters ---------- */}
      <div className="mb-10 flex items-center gap-7 text-sm">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "relative pb-2 transition-colors",
                active ? "font-semibold text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {f.label}
              {f.key === "live" && live.length > 0 && (
                <span className="ml-1.5 font-mono text-xs text-pitch">{live.length}</span>
              )}
              <span
                className={cn(
                  "absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-pitch transition-transform duration-300",
                  active ? "scale-x-100" : "scale-x-0",
                )}
              />
            </button>
          );
        })}
      </div>

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
