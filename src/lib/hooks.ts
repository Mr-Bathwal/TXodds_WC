"use client";

import useSWR from "swr";
import type { Fixture, MatchResult } from "@/lib/txline";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export interface FixturesResponse {
  fixtures: Fixture[];
  source: "mock" | "live";
  live: boolean;
}

/** Live fixtures list. Auto-refreshes so scores/odds tick during a match. */
export function useFixtures(refreshMs = 12_000) {
  const { data, error, isLoading } = useSWR<FixturesResponse>("/api/fixtures", fetcher, {
    refreshInterval: refreshMs,
    revalidateOnFocus: true,
  });
  return { data, error, isLoading };
}

export interface FixtureResponse {
  fixture: Fixture;
  result: MatchResult | null;
  source: "mock" | "live";
}

export function useFixture(id: string, refreshMs = 8_000) {
  const { data, error, isLoading } = useSWR<FixtureResponse>(
    id ? `/api/fixtures/${id}` : null,
    fetcher,
    { refreshInterval: refreshMs, revalidateOnFocus: true },
  );
  return { fixture: data?.fixture, result: data?.result, error, isLoading };
}
