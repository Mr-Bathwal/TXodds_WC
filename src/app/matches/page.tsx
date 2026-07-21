"use client";

import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useFixtures } from "@/lib/hooks";
import { FixtureRow } from "@/components/match/FixtureRow";
import { Rule } from "@/components/ui/Rule";
import { useTheme } from "@/lib/theme";
import type { Fixture } from "@/lib/txline";

const MiniBall = dynamic(() => import("@/components/three/MiniBall"), { ssr: false });

type View = "live" | "upcoming" | "finished";

const VIEW_META: Record<View, { title: string; empty: string }> = {
  live: { title: "Live now", empty: "No matches in play right now." },
  upcoming: { title: "Upcoming", empty: "No upcoming matches scheduled." },
  finished: { title: "Full time", empty: "No finished matches yet today." },
};

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

/** One of the three parallel lanes — light border for separation, open feel. */
function Lane({
  view,
  fixtures,
  accent,
}: {
  view: View;
  fixtures: Fixture[];
  accent: string;
}) {
  const meta = VIEW_META[view];
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-border/40 p-3 sm:p-4">
      <div className="mb-1 flex items-baseline justify-between px-1">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-muted">
          {view === "live" && <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" />}
          {meta.title}
        </h2>
        <span className={`font-mono text-xs ${accent}`}>{fixtures.length}</span>
      </div>

      {fixtures.length === 0 ? (
        <p className="px-1 py-10 text-center text-xs text-muted">{meta.empty}</p>
      ) : (
        <div className="max-h-[600px] divide-y divide-border overflow-y-auto">
          {fixtures.map((f) => (
            <FixtureRow key={f.id} fixture={f} compact />
          ))}
        </div>
      )}

      <Link
        href={`/matches?view=${view}`}
        className="mt-2 rounded-xl py-2.5 text-center text-xs font-semibold text-muted transition-colors hover:bg-surface hover:text-pitch"
      >
        All {meta.title.toLowerCase()} matches →
      </Link>
    </div>
  );
}

function MatchesContent() {
  const { data, isLoading } = useFixtures();
  const { theme } = useTheme();
  const params = useSearchParams();
  const view = params.get("view") as View | null;
  const fixtures = data?.fixtures ?? [];

  const byView: Record<View, Fixture[]> = {
    live: fixtures.filter((f) => f.status === "live" || f.status === "halftime"),
    upcoming: fixtures.filter((f) => f.status === "scheduled"),
    finished: fixtures.filter((f) => f.status === "finished"),
  };

  /* ---------- dedicated full view (e.g. all live matches) ---------- */
  if (view && VIEW_META[view]) {
    const list = byView[view];
    return (
      <div className="mx-auto w-full max-w-4xl px-5 pb-28 pt-24">
        <Link href="/matches" className="text-sm text-muted transition-colors hover:text-foreground">
          ← Match Center
        </Link>
        <h1 className="text-display mt-6 text-4xl font-extrabold sm:text-5xl">
          {VIEW_META[view].title}
          <span className="ml-3 align-middle font-mono text-lg text-muted">{list.length}</span>
        </h1>
        <Rule className="my-8" />
        {isLoading && <p className="text-muted">Loading fixtures…</p>}
        {list.length === 0 && !isLoading ? (
          <p className="py-16 text-center text-sm text-muted">{VIEW_META[view].empty}</p>
        ) : (
          <div className="divide-y divide-border">
            {list.map((f) => (
              <FixtureRow key={f.id} fixture={f} />
            ))}
          </div>
        )}
      </div>
    );
  }

  /* ---------- default: three parallel lanes ---------- */
  return (
    <div className="mx-auto w-full max-w-7xl px-5 pb-28 pt-24">
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
          <div className="h-36 w-36 shrink-0 cursor-pointer sm:h-44 sm:w-44" title="Click to kick">
            <MiniBall glow={theme.three.glow} />
          </div>
        </div>
      </section>

      <LiveTicker fixtures={fixtures} />
      <Rule className="my-6" />

      {isLoading && <p className="text-muted">Loading fixtures…</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Lane view="live" fixtures={byView.live} accent="text-pitch" />
        <Lane view="upcoming" fixtures={byView.upcoming} accent="text-accent" />
        <Lane view="finished" fixtures={byView.finished} accent="text-muted" />
      </div>
    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={<p className="mx-auto max-w-4xl px-5 pt-28 text-muted">Loading…</p>}>
      <MatchesContent />
    </Suspense>
  );
}
