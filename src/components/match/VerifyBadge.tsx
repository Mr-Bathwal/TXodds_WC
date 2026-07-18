"use client";

import { useState } from "react";
import type { Fixture } from "@/lib/txline";
import { shortAddress } from "@/lib/utils";

/**
 * The trust layer made visible. Shows that this match's data has a Merkle root
 * anchored on Solana (via TxLINE), with a click-through to the explorer.
 */
export function VerifyBadge({ verification }: { verification: NonNullable<Fixture["verification"]> }) {
  const [open, setOpen] = useState(false);
  const explorer =
    verification.explorerUrl ??
    `https://explorer.solana.com/tx/${verification.signature}?cluster=${verification.cluster}`;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-sol-teal/30 bg-sol-teal/5 px-2.5 py-1 text-xs text-sol-teal transition-colors hover:bg-sol-teal/10"
        title="Data verified on Solana"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5l-8-3Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Verified on-chain
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-border bg-surface p-3 text-xs shadow-xl">
          <p className="mb-2 text-muted">
            TxLINE publishes each data batch&rsquo;s Merkle root to Solana, so this result is
            tamper-proof and independently auditable.
          </p>
          <dl className="space-y-1.5 font-mono">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Merkle root</dt>
              <dd className="text-foreground">{shortAddress(verification.merkleRoot, 6)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Published</dt>
              <dd className="text-foreground">
                {new Date(verification.publishedAt * 1000).toLocaleTimeString()}
              </dd>
            </div>
            {verification.proofDepth != null && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Merkle proof</dt>
                <dd className="text-foreground">{verification.proofDepth}-node path</dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Cluster</dt>
              <dd className="text-sol-teal">{verification.cluster}</dd>
            </div>
          </dl>
          <a
            href={explorer}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block rounded-lg bg-sol-purple/15 px-2 py-1.5 text-center text-sol-purple hover:bg-sol-purple/25"
          >
            View on Solana Explorer ↗
          </a>
        </div>
      )}
    </div>
  );
}
