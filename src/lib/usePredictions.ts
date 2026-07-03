"use client";

import { useCallback, useEffect, useState } from "react";
import {
  computeStats,
  loadPredictions,
  settlePending,
  type Prediction,
  type UserStats,
} from "@/lib/predictions";
import { useFixtures } from "@/lib/hooks";

/** Reactive access to the user's predictions + stats, with auto-settlement. */
export function usePredictions(): { predictions: Prediction[]; stats: UserStats; refresh: () => void } {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const { data } = useFixtures();

  const refresh = useCallback(() => setPredictions(loadPredictions()), []);

  useEffect(() => {
    refresh();
    window.addEventListener("matchpulse:predictions", refresh);
    return () => window.removeEventListener("matchpulse:predictions", refresh);
  }, [refresh]);

  // Grade pending predictions whenever fresh fixtures arrive.
  useEffect(() => {
    if (data?.fixtures) {
      const { changed } = settlePending(data.fixtures);
      if (changed) refresh();
    }
  }, [data, refresh]);

  return { predictions, stats: computeStats(predictions), refresh };
}
