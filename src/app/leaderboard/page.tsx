"use client";

import { useEffect, useMemo, useState } from "react";
import { usePredictions } from "@/lib/usePredictions";
import { buildLeaderboard, type LeaderRow } from "@/lib/leaderboard";
import { getDisplayName, getIdentity } from "@/lib/solana/identity";
import { Rule } from "@/components/ui/Rule";
import { cn, fnv1a, seededRandom } from "@/lib/utils";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { adjustBalance, START_BALANCE } from "@/lib/predictions";
import bs58 from "bs58";

/* ---------------- Celebration confetti ---------------- */

const RANK_COLORS: Record<number, string[]> = {
  1: ["#ffcf5c", "#ffe9b0", "#1ad17a", "#ffffff"],
  2: ["#cbd5e1", "#f1f5f9", "#8fd8ff", "#ffffff"],
  3: ["#d97706", "#fbbf24", "#ff8a4c", "#ffffff"],
};

/** One-shot confetti burst; remounts (new key) to celebrate again. */
function ConfettiBurst({ rank, burst }: { rank: number; burst: number }) {
  const pieces = useMemo(() => {
    const seed = fnv1a(`confetti-${rank}-${burst}`);
    return Array.from({ length: 26 }).map((_, i) => {
      const angle = seededRandom(seed + i) * Math.PI * 2;
      const dist = 60 + seededRandom(seed + i * 7) * 130;
      return {
        cx: `${Math.cos(angle) * dist}px`,
        cy: `${Math.sin(angle) * dist - 70}px`,
        rot: `${Math.round(seededRandom(seed + i * 13) * 720 - 360)}deg`,
        color: RANK_COLORS[rank][i % RANK_COLORS[rank].length],
        delay: `${seededRandom(seed + i * 17) * 0.12}s`,
      };
    });
  }, [rank, burst]);

  if (burst === 0) return null;
  return (
    <div key={burst} className="pointer-events-none absolute inset-x-0 top-8 z-10 flex justify-center">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            background: p.color,
            animationDelay: p.delay,
            ["--cx" as string]: p.cx,
            ["--cy" as string]: p.cy,
            ["--rot" as string]: p.rot,
          }}
        />
      ))}
    </div>
  );
}

/* ---------------- Podium column ---------------- */

function PodiumColumn({ r }: { r: LeaderRow }) {
  const [burst, setBurst] = useState(0);
  const first = r.rank === 1;
  const medal = r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉";
  const glow =
    r.rank === 1
      ? "rgba(255,207,92,0.22)"
      : r.rank === 2
        ? "rgba(203,213,225,0.14)"
        : "rgba(217,119,6,0.16)";

  return (
    <div
      className="sheen group relative flex w-32 cursor-pointer flex-col items-center overflow-visible sm:w-44"
      onMouseEnter={() => setBurst((b) => b + 1)}
    >
      {/* celebration */}
      <ConfettiBurst rank={r.rank} burst={burst} />
      {/* rank glow floods in on hover */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-44 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(60% 70% at 50% 100%, ${glow}, transparent)` }}
      />
      <span className={cn("text-3xl transition-transform", first && "text-4xl", "group-hover:animate-[medalPop_0.6s_ease-out]")}>
        {medal}
      </span>
      <span
        className={cn(
          "text-display mt-2 w-full truncate text-center font-bold",
          first ? "text-xl" : "text-base",
          r.isUser && "text-pitch",
        )}
      >
        {r.name}
      </span>
      <span className="mt-0.5 font-mono text-sm text-muted tabular-nums">{r.points} pts</span>
      <div
        className={cn(
          "mt-3 w-full rounded-t-2xl transition-all duration-300 group-hover:scale-x-105",
          first
            ? "h-28 bg-gradient-to-b from-gold/30 via-gold/10 to-transparent group-hover:from-gold/50"
            : r.rank === 2
              ? "h-16 bg-gradient-to-b from-slate-300/20 to-transparent group-hover:from-slate-300/35"
              : "h-16 bg-gradient-to-b from-amber-600/20 to-transparent group-hover:from-amber-600/35",
        )}
      />
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function LeaderboardPage() {
  const { stats } = usePredictions();
  const [name, setName] = useState("You");

  useEffect(() => {
    const id = getIdentity();
    setName(getDisplayName() ?? `Player ${id.publicKey.slice(0, 4)}`);
  }, []);

  const rows = buildLeaderboard({
    name,
    points: stats.points,
    accuracy: stats.accuracy,
    streak: stats.streak,
  });
  const you = rows.find((r) => r.isUser);

  return (
    <div className="mx-auto w-full max-w-4xl px-5 pb-28 pt-24">
      {/* ---------- header — stadium footage backdrop ---------- */}
      <section className="relative">
        <video
          className="pointer-events-none absolute -inset-x-10 -top-16 -z-10 h-64 w-[calc(100%+5rem)] object-cover opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent)]"
          src="/videos/stadium-night.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="pointer-events-none absolute -inset-x-20 -top-24 h-64 -z-10 bg-[radial-gradient(55%_80%_at_50%_0%,rgba(255,207,92,0.10),transparent_70%)]" />
        <h1 className="text-display text-4xl font-extrabold sm:text-5xl">
          The <span className="gradient-text">table</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted sm:text-base">
          Odds-weighted points — bold calls earn more. Every score is backed by on-chain proof,
          so no one inflates their rank.
        </p>
      </section>

      <Rule />

      {/* ---------- podium (hover to celebrate) ---------- */}
      <section className="flex items-end justify-center gap-4 sm:gap-8">
        {[rows[1], rows[0], rows[2]].filter(Boolean).map((r) => (
          <PodiumColumn key={r.rank} r={r} />
        ))}
      </section>

      {/* ---------- your rank — open band ---------- */}
      {you && (
        <>
          <Rule className="my-10" />
          <section className="grid grid-cols-3 items-end divide-x divide-border/40 text-center">
            <div>
              <div className="text-display text-5xl font-extrabold tabular-nums">#{you.rank}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted">your rank</div>
            </div>
            <div>
              <div className="text-display text-5xl font-extrabold text-pitch tabular-nums">
                {you.points}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted">balance</div>
            </div>
            <div>
              <div className="text-display text-5xl font-extrabold tabular-nums">
                {stats.streak > 0 ? `🔥${stats.streak}` : "—"}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.25em] text-muted">streak</div>
            </div>
          </section>
          
          <ClaimRewards points={you.points} />

          <Rule className="my-10" />
        </>
      )}

      {/* ---------- ledger ---------- */}
      <section>
        <div className="grid grid-cols-[3rem_1fr_5rem_6rem] gap-2 pb-3 text-[11px] uppercase tracking-[0.2em] text-muted">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Acc</span>
          <span className="text-right">Points</span>
        </div>
        <div className="divide-y divide-border/40">
          {rows.slice(0, 20).map((r) => (
            <Row key={`${r.name}-${r.rank}`} row={r} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Row({ row }: { row: LeaderRow }) {
  const medal = row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : null;
  return (
    <div
      onMouseMove={(e) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "spot-row group grid grid-cols-[3rem_1fr_5rem_6rem] items-center gap-2 px-2 py-3 text-sm",
        row.isUser && "bg-gradient-to-r from-pitch/10 to-transparent",
      )}
    >
      <span className="font-mono text-muted tabular-nums">
        {medal ? (
          <span className="inline-block transition-transform duration-300 group-hover:scale-125">
            {medal}
          </span>
        ) : (
          row.rank
        )}
      </span>
      <span className="flex items-center gap-2 truncate">
        {/* ball rolls in on hover */}
        <span
          aria-hidden
          className="-ml-1 w-0 -translate-x-2 text-[11px] opacity-0 transition-all duration-300 group-hover:w-4 group-hover:translate-x-0 group-hover:rotate-[360deg] group-hover:opacity-100"
        >
          ⚽
        </span>
        <span
          className={cn(
            "truncate transition-colors group-hover:text-pitch",
            row.isUser && "font-semibold text-pitch",
          )}
        >
          {row.name}
        </span>
        {row.streak > 0 && <span className="text-xs text-accent">🔥{row.streak}</span>}
        {row.isUser && (
          <span className="text-[10px] uppercase tracking-wider text-pitch/80">you</span>
        )}
      </span>
      <span className="text-right font-mono text-muted tabular-nums">
        {Math.round(row.accuracy * 100)}%
      </span>
      <span className="text-right font-mono text-base font-semibold tabular-nums transition-colors group-hover:text-pitch">
        {row.points}
      </span>
    </div>
  );
}

function ClaimRewards({ points }: { points: number }) {
  const { publicKey, signMessage } = useWallet();
  const [status, setStatus] = useState<"idle" | "claiming" | "success" | "error" | "no_offers">("idle");
  const [tx, setTx] = useState("");

  const surplus = points - START_BALANCE;
  const claimAmount = Math.max(0, surplus) * 0.00001; // 1000 surplus = 0.01 SOL

  async function handleClaim() {
    if (!publicKey || !signMessage) return;
    
    if (surplus <= 0) {
      setStatus("no_offers");
      return;
    }

    setStatus("claiming");
    try {
      const message = `Claim MatchPulse rewards for ${surplus} points`;
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const signature = bs58.encode(sigBytes);

      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(),
          amountSOL: claimAmount,
          signature,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Claim failed");

      adjustBalance(-surplus); // Deduct points locally
      setTx(data.signature);
      setStatus("success");
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  }

  return (
    <div className="my-8 rounded-2xl border border-pitch/30 bg-pitch/5 p-6 text-center">
      <h3 className="mb-2 text-xl font-bold text-pitch">Claim Winnings</h3>
      <p className="mb-4 text-sm text-muted">
        {surplus > 0 ? (
          <>
            You have a surplus of <strong className="text-foreground">{surplus.toLocaleString()} Pulse Points</strong> above the starting balance.
            <br />
            Claim them to your connected wallet as <strong className="text-sol-teal">{claimAmount.toFixed(4)} Devnet SOL</strong>!
          </>
        ) : (
          <>
            You need a balance greater than <strong className="text-foreground">{START_BALANCE.toLocaleString()}</strong> to claim.
            <br />
            Keep predicting matches to increase your stack!
          </>
        )}
      </p>
      
      {!publicKey ? (
        <div className="flex justify-center">
          <WalletMultiButton style={{ background: "rgba(26,209,122,0.15)", color: "#1ad17a", border: "1px solid rgba(26,209,122,0.3)" }} />
        </div>
      ) : status === "success" ? (
        <div className="text-sm">
          <span className="text-pitch font-semibold">Claim Successful!</span>
          <br />
          <a href={`https://explorer.solana.com/tx/${tx}?cluster=devnet`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sol-purple hover:underline">
            View on Explorer ↗
          </a>
        </div>
      ) : (
        <div>
          <button
            onClick={handleClaim}
            disabled={status === "claiming"}
            className="rounded-full bg-pitch px-8 py-3 text-sm font-bold text-background transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
          >
            {status === "claiming" ? "Claiming..." : "Sign & Claim"}
          </button>
          {status === "error" && <p className="mt-2 text-xs text-danger">Failed to claim. Please try again.</p>}
          {status === "no_offers" && <p className="mt-2 text-xs text-muted">No offers claimable. Increase your balance first!</p>}
        </div>
      )}
    </div>
  );
}
