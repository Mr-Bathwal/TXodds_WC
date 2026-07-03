/** Display helpers for dates, odds and on-chain values. */

export function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMin = Math.round((d.getTime() - now) / 60_000);
  if (diffMin > 0 && diffMin < 60) return `in ${diffMin}m`;
  if (diffMin >= 60 && diffMin < 1440) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Decimal odds -> implied probability %. */
export function impliedProb(odds: number): number {
  return Math.round((1 / odds) * 100);
}

export function formatOdds(odds: number): string {
  return odds.toFixed(2);
}
