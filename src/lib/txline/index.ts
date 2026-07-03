import { MockTxLineClient } from "./mock";
import { LiveTxLineClient } from "./live";
import type { TxLineClient } from "./types";

export * from "./types";

/**
 * Returns the active TxLINE client.
 *
 * Uses the live provider when `TXLINE_API_TOKEN` is present (set after the
 * on-chain World Cup subscription is activated), otherwise the mock provider so
 * the whole app runs — and demos — with zero configuration.
 */
let cached: TxLineClient | null = null;

export function getTxLineClient(): TxLineClient {
  if (cached) return cached;
  const token = process.env.TXLINE_API_TOKEN;
  cached = token ? new LiveTxLineClient(token) : new MockTxLineClient();
  return cached;
}

/** True when running against real TxLINE data. */
export function isLive(): boolean {
  return Boolean(process.env.TXLINE_API_TOKEN);
}
