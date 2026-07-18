"use client";

import { useEffect, useState } from "react";
import { getIdentity, getDisplayName, setDisplayName } from "@/lib/solana/identity";
import { shortAddress } from "@/lib/utils";
import type { UserStats } from "@/lib/predictions";

/** Deterministic gradient avatar from a public key. */
function avatarGradient(pubkey: string): string {
  const hue = pubkey.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `linear-gradient(135deg, hsl(${hue} 70% 45%), hsl(${(hue + 60) % 360} 70% 40%))`;
}

/**
 * Identity — open section, no card chrome. Avatar + editable name on the
 * left, display-size points numeral on the right, then an open stat band
 * split by hairlines.
 */
export function IdentityBar({ stats }: { stats: UserStats }) {
  const [pubkey, setPubkey] = useState("");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const id = getIdentity();
    setPubkey(id.publicKey);
    setName(getDisplayName() ?? `Player ${id.publicKey.slice(0, 4)}`);
  }, []);

  function commitName() {
    setDisplayName(name);
    setEditing(false);
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 shrink-0 rounded-full ring-2 ring-white/10"
            style={{ background: pubkey ? avatarGradient(pubkey) : "var(--surface-2)" }}
          />
          <div className="min-w-0">
            {editing ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === "Enter" && commitName()}
                maxLength={24}
                className="w-full max-w-[14rem] border-b border-pitch bg-transparent pb-0.5 text-xl font-bold outline-none"
              />
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-display block truncate text-left text-xl font-bold transition-colors hover:text-pitch"
                title="Edit display name"
              >
                {name} <span className="text-sm text-muted">✎</span>
              </button>
            )}
            <div className="mt-1 flex items-center gap-1.5 font-mono text-xs text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-sol-teal" />
              {pubkey ? shortAddress(pubkey, 4) : "…"} · Solana identity
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-display text-6xl font-extrabold text-pitch tabular-nums">
            {stats.points}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.25em] text-muted">balance</div>
        </div>
      </div>

      {/* open stat band */}
      <div className="mt-8 grid grid-cols-3 divide-x divide-border/40 text-center">
        <Stat label="Accuracy" value={stats.settled ? `${Math.round(stats.accuracy * 100)}%` : "—"} />
        <Stat label="Streak" value={stats.streak > 0 ? `🔥 ${stats.streak}` : "—"} />
        <Stat label="Correct" value={`${stats.won}/${stats.settled}`} />
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1">
      <div className="font-mono text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-muted">{label}</div>
    </div>
  );
}
