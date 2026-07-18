"use client";

import { useEffect, useRef, useState } from "react";
import type { Fixture } from "@/lib/txline";
import { type Pick, pickLabel } from "@/lib/solana/commitment";
import { commitPrediction } from "@/lib/commitPrediction";
import {
  canTopUp,
  getBalance,
  loadPredictions,
  MIN_STAKE,
  pointsFor,
  START_BALANCE,
  topUp,
  TOPUP_AMOUNT,
  type Prediction,
} from "@/lib/predictions";
import { cn, shortAddress } from "@/lib/utils";

type Market = "1x2" | "over_under";
const OU_LINE = 2.5;
const PRESETS = [100, 250, 500, 1000];

function oddsForPick(fixture: Fixture, pick: Pick): number {
  if (pick.market === "1x2") return fixture.odds[pick.value];
  if (pick.market === "over_under") return 1.9;
  return 2.5;
}

export function PredictPanel({ fixture }: { fixture: Fixture }) {
  const [market, setMarket] = useState<Market>("1x2");
  const [pick, setPick] = useState<Pick | null>(null);
  const [stake, setStake] = useState(250);
  const [status, setStatus] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [committed, setCommitted] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState(START_BALANCE);
  const [bets, setBets] = useState<Prediction[]>([]);

  useEffect(() => {
    const refresh = () => {
      setBalance(getBalance());
      setBets(loadPredictions().filter((p) => p.fixtureId === fixture.id));
    };
    refresh();
    window.addEventListener("matchpulse:predictions", refresh);
    return () => window.removeEventListener("matchpulse:predictions", refresh);
  }, [fixture.id]);

  // keep the stake within the available bankroll
  useEffect(() => {
    setStake((s) => Math.min(Math.max(MIN_STAKE, s), Math.max(MIN_STAKE, balance)));
  }, [balance]);

  const closed = fixture.status === "finished";
  const isLive = fixture.status === "live" || fixture.status === "halftime";

  async function handleCommit() {
    if (!pick || stake < MIN_STAKE || stake > balance) return;
    setStatus("signing");
    setError(null);
    try {
      const result = await commitPrediction(fixture, pick, stake);
      setCommitted(result);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
  }

  if (closed && bets.length === 0) {
    return (
      <section className="py-2 text-center text-sm text-muted">
        Predictions are closed — this match has finished.
      </section>
    );
  }

  const done = status === "done" && committed;
  const selectedOdds = pick ? oddsForPick(fixture, pick) : 0;
  const potential = pick ? pointsFor(selectedOdds, stake) : 0;
  const insufficient = stake > balance;

  const options =
    market === "1x2"
      ? ([
          { key: "home", label: fixture.home.code, odds: fixture.odds.home, pick: { market: "1x2", value: "home" } },
          { key: "draw", label: "Draw", odds: fixture.odds.draw, pick: { market: "1x2", value: "draw" } },
          { key: "away", label: fixture.away.code, odds: fixture.odds.away, pick: { market: "1x2", value: "away" } },
        ] as const)
      : ([
          { key: "over", label: `Over ${OU_LINE}`, odds: 1.9, pick: { market: "over_under", value: "over", line: OU_LINE } },
          { key: "under", label: `Under ${OU_LINE}`, odds: 1.9, pick: { market: "over_under", value: "under", line: OU_LINE } },
        ] as const);

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Predict &amp; Prove</h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm">
            <span className="text-muted">Balance </span>
            <span className={cn("font-semibold", balance < 500 ? "text-danger" : "text-pitch")}>
              {balance.toLocaleString()}
            </span>
          </span>
          {canTopUp() && balance < 2000 && (
            <button
              onClick={() => topUp()}
              className="rounded-full border border-pitch/40 bg-pitch/10 px-2.5 py-0.5 text-[11px] font-semibold text-pitch hover:bg-pitch/20"
            >
              + Top up {TOPUP_AMOUNT.toLocaleString()}
            </button>
          )}
        </div>
      </div>

      {!closed && (
        <>
          {done ? (
            <CommittedReceipt
              prediction={committed!}
              onReset={() => { setStatus("idle"); setPick(null); setCommitted(null); }}
            />
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex gap-1 rounded-full bg-surface-2 p-1 text-sm">
                  {(["1x2", "over_under"] as Market[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMarket(m); setPick(null); }}
                      className={cn(
                        "rounded-full px-4 py-1.5 transition-colors",
                        market === m ? "bg-pitch text-background font-semibold" : "text-muted hover:text-foreground",
                      )}
                    >
                      {m === "1x2" ? "Match result" : `Total goals ${OU_LINE}`}
                    </button>
                  ))}
                </div>
                {isLive && (
                  <span className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" /> odds moving live
                  </span>
                )}
              </div>

              <div className={cn("grid gap-2", market === "1x2" ? "grid-cols-3" : "grid-cols-2")}>
                {options.map((o) => (
                  <OptionButton
                    key={o.key}
                    label={o.label}
                    odds={o.odds}
                    points={pointsFor(o.odds, stake)}
                    live={isLive}
                    selected={!!pick && pick.market === o.pick.market && pick.value === o.pick.value}
                    onClick={() => setPick(o.pick as Pick)}
                  />
                ))}
              </div>

              {/* stake — presets + manual entry + max */}
              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted">
                  <span>Stake</span>
                  {insufficient && <span className="text-danger">Over balance</span>}
                </div>
                <div className="flex gap-2">
                  <div className="flex flex-1 gap-2">
                    {PRESETS.map((s) => (
                      <button
                        key={s}
                        disabled={s > balance}
                        onClick={() => setStake(s)}
                        className={cn(
                          "flex-1 rounded-lg border py-1.5 font-mono text-sm transition-colors disabled:opacity-30",
                          stake === s ? "border-pitch bg-pitch/10 text-pitch" : "border-border text-muted hover:border-pitch/40",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    min={MIN_STAKE}
                    max={balance}
                    value={stake}
                    onChange={(e) => setStake(Math.max(MIN_STAKE, Math.min(balance, Math.floor(Number(e.target.value) || 0))))}
                    className={cn(
                      "w-24 rounded-lg border bg-surface-2 px-2 py-1.5 text-center font-mono text-sm outline-none focus:ring-1 focus:ring-pitch",
                      insufficient ? "border-danger" : "border-border",
                    )}
                  />
                  <button
                    onClick={() => setStake(balance)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-pitch/40 hover:text-pitch"
                  >
                    Max
                  </button>
                </div>
              </div>

              <button
                disabled={!pick || status === "signing" || insufficient || stake < MIN_STAKE}
                onClick={handleCommit}
                className={cn(
                  "mt-4 w-full rounded-xl py-2.5 text-sm font-semibold transition-all",
                  !pick || insufficient
                    ? "cursor-not-allowed bg-surface-2 text-muted"
                    : "bg-gradient-to-r from-sol-purple to-sol-teal text-background hover:opacity-90",
                )}
              >
                {status === "signing"
                  ? "Anchoring on Solana…"
                  : insufficient
                    ? "Insufficient balance"
                    : pick
                      ? `Stake ${stake.toLocaleString()} → win ${potential.toLocaleString()}`
                      : "Choose your call"}
              </button>
              <p className="mt-2 text-center text-xs text-muted">
                {isLive
                  ? "Live odds locked at this instant & anchored on-chain. Bet as many times as you like."
                  : "Each pick is hashed & timestamped on-chain. You can place multiple bets as odds move."}
              </p>
              {error && <p className="mt-2 text-center text-xs text-danger">{error}</p>}
            </>
          )}
        </>
      )}

      {/* your bets on this match */}
      {bets.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] uppercase tracking-wider text-muted">
            Your bets on this match ({bets.length})
          </div>
          <div className="divide-y divide-border/40">
            {bets.map((b) => (
              <BetRow key={b.id} bet={b} fixture={fixture} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** Odds tile with a live green-up / red-down flash when the TxLINE price moves. */
function OptionButton({
  label,
  odds,
  points,
  live,
  selected,
  onClick,
}: {
  label: string;
  odds: number;
  points: number;
  live: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const prev = useRef(odds);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const implied = Math.round((1 / odds) * 100);

  useEffect(() => {
    if (odds > prev.current) setFlash("up");
    else if (odds < prev.current) setFlash("down");
    prev.current = odds;
  }, [odds]);
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 1000);
    return () => clearTimeout(t);
  }, [flash]);

  return (
    <button
      onClick={onClick}
      className={cn(
        "group/opt relative flex flex-col items-center overflow-hidden rounded-xl border py-3 transition-all",
        selected ? "border-pitch bg-pitch/10" : "border-border bg-surface-2 hover:border-pitch/40",
        flash === "up" && "ring-1 ring-pitch/60",
        flash === "down" && "ring-1 ring-danger/60",
      )}
    >
      <div
        className={cn("absolute bottom-0 left-0 h-0.5 transition-all duration-700", selected ? "bg-pitch" : "bg-pitch/30")}
        style={{ width: `${implied}%` }}
      />
      <span className="text-sm font-semibold">{label}</span>
      <span
        className={cn(
          "mt-0.5 flex items-center gap-1 font-mono text-xs transition-colors duration-300",
          flash === "up" ? "text-pitch" : flash === "down" ? "text-danger" : "text-muted",
        )}
      >
        {live && flash === "up" && <span aria-hidden>▲</span>}
        {live && flash === "down" && <span aria-hidden>▼</span>}
        {odds.toFixed(2)} · {implied}%
      </span>
      <span className="mt-1 text-[11px] text-pitch">win {points.toLocaleString()}</span>
    </button>
  );
}

function BetRow({ bet, fixture }: { bet: Prediction; fixture: Fixture }) {
  const tone =
    bet.status === "won"
      ? "text-pitch"
      : bet.status === "lost"
        ? "text-danger"
        : bet.status === "void"
          ? "text-muted"
          : "text-accent";
  const toWin = Math.round((bet.stake ?? 100) * bet.oddsAtCommit);
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <div className="min-w-0">
        <span className="font-medium">{pickLabel(bet.pick, fixture.home.code, fixture.away.code)}</span>
        <span className="ml-2 font-mono text-xs text-muted">
          {(bet.stake ?? 100).toLocaleString()} @ {bet.oddsAtCommit.toFixed(2)}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn("font-mono text-xs font-semibold uppercase tracking-wider", tone)}>
          {bet.status === "pending"
            ? `to win ${toWin.toLocaleString()}`
            : bet.status === "won"
              ? `+${bet.points.toLocaleString()}`
              : bet.status}
        </span>
        <a href={bet.explorer} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-sol-purple hover:underline">
          {shortAddress(bet.signature, 4)} ↗
        </a>
      </div>
    </div>
  );
}

function CommittedReceipt({ prediction, onReset }: { prediction: Prediction; onReset: () => void }) {
  const stake = prediction.stake ?? 100;
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-pitch/15">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-pitch">
          <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="font-semibold">Bet placed &amp; anchored on-chain</p>
      <p className="mt-1 text-xs text-muted">
        {stake.toLocaleString()} staked at {prediction.oddsAtCommit.toFixed(2)} · to win{" "}
        <span className="text-pitch">{Math.round(stake * prediction.oddsAtCommit).toLocaleString()}</span>
      </p>
      <div className="mt-3 rounded-xl bg-surface-2 p-3 text-left font-mono text-xs">
        <div className="flex justify-between gap-2">
          <span className="text-muted">hash</span>
          <span>{shortAddress(prediction.hash, 6)}</span>
        </div>
        <div className="mt-1 flex justify-between gap-2">
          <span className="text-muted">tx</span>
          <span>{shortAddress(prediction.signature, 6)}</span>
        </div>
      </div>
      <a
        href={prediction.explorer}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block rounded-lg bg-sol-purple/15 px-2 py-2 text-sm text-sol-purple hover:bg-sol-purple/25"
      >
        {prediction.simulated ? "View anchor (devnet demo) ↗" : "Verify on Solana Explorer ↗"}
      </a>
      <button onClick={onReset} className="mt-3 rounded-full bg-pitch px-5 py-1.5 text-xs font-semibold text-background">
        Place another bet
      </button>
    </div>
  );
}
