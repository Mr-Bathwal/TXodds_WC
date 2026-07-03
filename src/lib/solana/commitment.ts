/**
 * Prediction commitment format shared by client (build + sign) and server
 * (anchor on-chain). A commitment is a canonical string that is hashed with
 * SHA-256; the hash is what gets written to Solana, so the on-chain footprint is
 * tiny and privacy-preserving, yet the pick is provably fixed before kickoff.
 */

export type Market = "1x2" | "over_under" | "next_goal";

/** The user's selection within a market. */
export type Pick =
  | { market: "1x2"; value: "home" | "draw" | "away" }
  | { market: "over_under"; value: "over" | "under"; line: number }
  | { market: "next_goal"; value: "home" | "away" | "none" };

export interface Commitment {
  fixtureId: string;
  pick: Pick;
  /** Random nonce so identical picks produce distinct commitments. */
  nonce: string;
  /** Client timestamp (ms) — the "before kickoff" claim, verified against kickoff. */
  createdAt: number;
  /** base58 author public key (in-browser identity or linked wallet). */
  author: string;
}

const PREFIX = "MatchPulse|v1";

/** Canonical, stable serialization used for hashing + signing. */
export function serializeCommitment(c: Commitment): string {
  const pick = JSON.stringify(c.pick, Object.keys(c.pick).sort());
  return [PREFIX, c.fixtureId, pick, c.nonce, c.createdAt, c.author].join("|");
}

/** SHA-256 hex digest of a commitment (works in browser and Node). */
export async function hashCommitment(c: Commitment): Promise<string> {
  const bytes = new TextEncoder().encode(serializeCommitment(c));
  // Copy into a concrete ArrayBuffer so the type is BufferSource under strict TS.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The compact memo payload written on-chain. */
export function memoPayload(hash: string, author: string, createdAt: number): string {
  return `mp1:${hash}:${author}:${createdAt}`;
}

export function marketLabel(market: Market): string {
  return market === "1x2" ? "Match result" : market === "over_under" ? "Total goals" : "Next goal";
}

export function pickLabel(pick: Pick, homeName: string, awayName: string): string {
  switch (pick.market) {
    case "1x2":
      return pick.value === "home" ? homeName : pick.value === "away" ? awayName : "Draw";
    case "over_under":
      return `${pick.value === "over" ? "Over" : "Under"} ${pick.line}`;
    case "next_goal":
      return pick.value === "home" ? homeName : pick.value === "away" ? awayName : "No more goals";
  }
}
