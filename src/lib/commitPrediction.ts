"use client";

import { getIdentity, signMessage } from "@/lib/solana/identity";
import { serializeCommitment, type Commitment, type Pick } from "@/lib/solana/commitment";
import { addPrediction, type Prediction } from "@/lib/predictions";
import type { Fixture } from "@/lib/txline";

function oddsForPick(fixture: Fixture, pick: Pick): number {
  if (pick.market === "1x2") return fixture.odds[pick.value];
  if (pick.market === "over_under") return 1.9; // symmetric demo line
  return 2.5; // next_goal
}

/**
 * Full commit flow: build the commitment, sign it with the in-browser identity,
 * anchor its hash on Solana via the relayer, and persist the pending prediction.
 * Throws on failure so the UI can show an error.
 */
export async function commitPrediction(
  fixture: Fixture,
  pick: Pick,
  stake = 100,
  wallet?: { publicKey: string; signMessage: (msg: Uint8Array) => Promise<Uint8Array> }
): Promise<Prediction> {
  const authorPubkey = wallet ? wallet.publicKey : getIdentity().publicKey;
  const commitment: Commitment = {
    fixtureId: fixture.id,
    pick,
    nonce: crypto.randomUUID(),
    createdAt: Date.now(),
    author: authorPubkey,
  };
  const messageStr = serializeCommitment(commitment);
  let signature: string;
  if (wallet) {
    const sigBytes = await wallet.signMessage(new TextEncoder().encode(messageStr));
    // bs58 encode the Uint8Array signature from the wallet
    const bs58 = (await import("bs58")).default;
    signature = bs58.encode(sigBytes);
  } else {
    signature = signMessage(messageStr);
  }

  const res = await fetch("/api/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commitment, signature }),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Commit failed (${res.status})`);
  }
  const anchor = (await res.json()) as {
    hash: string;
    signature: string;
    explorer: string;
    cluster: string;
    simulated: boolean;
  };

  const prediction: Prediction = {
    id: commitment.nonce,
    fixtureId: fixture.id,
    matchLabel: `${fixture.home.code} vs ${fixture.away.code}`,
    pick,
    createdAt: commitment.createdAt,
    kickoff: fixture.kickoff,
    hash: anchor.hash,
    signature: anchor.signature,
    explorer: anchor.explorer,
    cluster: anchor.cluster,
    simulated: anchor.simulated,
    oddsAtCommit: oddsForPick(fixture, pick),
    stake,
    status: "pending",
    points: 0,
  };
  addPrediction(prediction);
  return prediction;
}
