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
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <div
          className="h-11 w-11 shrink-0 rounded-full"
          style={{ background: pubkey ? avatarGradient(pubkey) : "var(--surface-2)" }}
        />
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => e.key === "Enter" && commitName()}
              maxLength={24}
              className="w-full rounded-lg bg-surface-2 px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-pitch"
            />
          ) : (
            <button onClick={() => setEditing(true)} className="block truncate font-semibold hover:text-pitch">
              {name} <span className="text-xs text-muted">✎</span>
            </button>
          )}
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-sol-teal" />
            {pubkey ? shortAddress(pubkey, 4) : "…"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-xl font-bold text-pitch tabular-nums">{stats.points}</div>
          <div className="text-[11px] uppercase tracking-wide text-muted">points</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Accuracy" value={stats.settled ? `${Math.round(stats.accuracy * 100)}%` : "—"} />
        <Stat label="Streak" value={stats.streak > 0 ? `🔥 ${stats.streak}` : "—"} />
        <Stat label="Correct" value={`${stats.won}/${stats.settled}`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <div className="font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}
