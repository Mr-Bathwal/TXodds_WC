"use client";

import { useMemo, useRef, useState } from "react";
import type { Fixture } from "@/lib/txline";
import { computeMomentum } from "@/lib/matchStats";
import { cn } from "@/lib/utils";

/**
 * Momentum. When the fixture carries a real TxLINE odds time-series
 * (`oddsHistory`), we render **market momentum** — how the de-margined win
 * probability actually moved over the match. Otherwise we fall back to the
 * simulated per-minute pressure view (demo feed).
 */
export function MomentumChart({ fixture }: { fixture: Fixture }) {
  if (fixture.status === "scheduled") {
    return <PreMatchMomentum fixture={fixture} />;
  }
  if (fixture.oddsHistory && fixture.oddsHistory.length >= 3) {
    return <MarketMomentum fixture={fixture} />;
  }
  return <SimulatedMomentum fixture={fixture} />;
}

/**
 * Pre-match: the fully-labelled chart frame with a flat 50% line — the market
 * hasn't moved because the match hasn't started. Keeps the page dressed
 * instead of showing an empty box.
 */
function PreMatchMomentum({ fixture }: { fixture: Fixture }) {
  const W = 900;
  const H = 230;
  const pad = 8;
  const y50 = pad + 0.5 * (H - 2 * pad);

  return (
    <section className="relative">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
          Market momentum
          <span className="ml-2 normal-case tracking-normal text-muted">· win probability · from TxLINE odds</span>
        </h2>
      </div>

      <div className="pointer-events-none absolute right-0 top-0 font-mono text-sm">
        <span className="text-pitch">{fixture.home.code} 50%</span>
        <span className="px-2 text-muted">·</span>
        <span className="text-sol-purple">{fixture.away.code} 50%</span>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Win probability (match not started)">
          <line x1={pad} y1={y50} x2={W - pad} y2={y50} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />
          <text x={pad + 2} y={y50 - 4} fontSize="9" fill="var(--muted)">50%</text>
          <path d={`M${pad} ${y50} L${W - pad} ${y50}`} fill="none" stroke="var(--pitch)" strokeWidth="2.5" opacity="0.5" />
        </svg>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-full border border-border/60 bg-surface/85 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted backdrop-blur-sm">
            Match not started
          </span>
        </div>
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        <span>kickoff</span>
        <span>full time</span>
      </div>
    </section>
  );
}

/** Real market momentum: home win probability over time, from TxLINE odds. */
function MarketMomentum({ fixture }: { fixture: Fixture }) {
  const hist = fixture.oddsHistory!;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const W = 900;
  const H = 230;
  const pad = 8;
  const x = (i: number) => pad + (i / (hist.length - 1)) * (W - 2 * pad);
  const y = (pct: number) => pad + (1 - pct / 100) * (H - 2 * pad);

  const homePath = hist.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.home).toFixed(1)}`).join(" ");
  const areaPath = `${homePath} L${x(hist.length - 1).toFixed(1)} ${H - pad} L${x(0).toFixed(1)} ${H - pad} Z`;

  const hi =
    hoverX == null
      ? hist.length - 1
      : Math.max(0, Math.min(hist.length - 1, Math.round(((hoverX - pad) / (W - 2 * pad)) * (hist.length - 1))));
  const cur = hist[hi];

  return (
    <section className="relative">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
          Market momentum
          <span className="ml-2 normal-case tracking-normal text-pitch">· live win probability</span>
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="live-dot h-1.5 w-1.5 rounded-full bg-pitch" /> from TxLINE odds
        </span>
      </div>

      <div className="pointer-events-none absolute right-0 top-0 font-mono text-sm">
        <span className="text-pitch">{fixture.home.code} {cur.home}%</span>
        <span className="px-2 text-muted">·</span>
        <span className="text-sol-purple">{fixture.away.code} {cur.away}%</span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        onMouseMove={(e) => {
          const r = svgRef.current?.getBoundingClientRect();
          if (r) setHoverX(((e.clientX - r.left) / r.width) * W);
        }}
        onMouseLeave={() => setHoverX(null)}
        role="img"
        aria-label="Win probability over time"
      >
        <defs>
          <linearGradient id="mmFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pitch)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--pitch)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={pad} y1={y(50)} x2={W - pad} y2={y(50)} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />
        <text x={pad + 2} y={y(50) - 4} fontSize="9" fill="var(--muted)">50%</text>

        <path d={areaPath} fill="url(#mmFill)" />
        <path d={homePath} fill="none" stroke="var(--pitch)" strokeWidth="2.5" strokeLinejoin="round" />

        {fixture.events
          .filter((e) => e.type === "goal")
          .map((e, i) => {
            const gx = pad + (Math.min(e.minute, 90) / 90) * (W - 2 * pad);
            return (
              <g key={i}>
                <line x1={gx} y1={pad} x2={gx} y2={H - pad} stroke="var(--accent)" strokeWidth="1" opacity="0.3" />
                <circle cx={gx} cy={pad + 8} r="8" fill="var(--background)" stroke="var(--accent)" strokeWidth="1.5" />
                <text x={gx} y={pad + 11} textAnchor="middle" fontSize="9">⚽</text>
              </g>
            );
          })}

        {hoverX != null && (
          <g>
            <line x1={x(hi)} y1={pad} x2={x(hi)} y2={H - pad} stroke="var(--foreground)" strokeWidth="1" opacity="0.35" />
            <circle cx={x(hi)} cy={y(cur.home)} r="4" fill="var(--pitch)" />
          </g>
        )}
      </svg>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        <span>kickoff</span>
        <span>{fixture.status === "finished" ? "full time" : "now"}</span>
      </div>
    </section>
  );
}

/** Simulated per-minute pressure view (demo feed only). */
function SimulatedMomentum({ fixture }: { fixture: Fixture }) {
  const points = useMemo(() => computeMomentum(fixture), [fixture]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverMin, setHoverMin] = useState<number | null>(null);
  if (points.length < 3) return null;

  const W = 900;
  const H = 230;
  const mid = H / 2;
  const barW = W / 90;

  const hovered = hoverMin ? points.find((p) => p.minute === hoverMin) : undefined;
  const dominance = hovered ? Math.round(Math.abs(hovered.value) * 100) : 0;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const m = Math.round(((e.clientX - rect.left) / rect.width) * 90);
    setHoverMin(Math.max(1, Math.min(90, m)));
  }

  return (
    <section className="relative">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Momentum</h2>
        <div className="flex items-center gap-5 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-pitch" /> {fixture.home.name}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-sol-purple" /> {fixture.away.name}
          </span>
        </div>
      </div>

      {/* hover readout */}
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 font-mono text-sm transition-opacity",
          hovered ? "opacity-100" : "opacity-0",
        )}
      >
        {hovered && (
          <span>
            <span className="text-muted">{hovered.minute}&rsquo; · </span>
            <span className={hovered.value >= 0 ? "text-pitch" : "text-sol-purple"}>
              {hovered.value >= 0 ? fixture.home.code : fixture.away.code} {dominance}%
            </span>
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverMin(null)}
        role="img"
        aria-label="Match momentum by minute"
      >
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="var(--border)" strokeWidth="1" />
        <line x1={barW * 45} y1="8" x2={barW * 45} y2={H - 8} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 5" />

        {points.map((p) => {
          const x = (p.minute - 1) * barW;
          const h = Math.abs(p.value) * (mid - 14);
          const isHome = p.value >= 0;
          const isHover = p.minute === hoverMin;
          return (
            <rect
              key={p.minute}
              x={x + 0.6}
              y={isHome ? mid - h : mid}
              width={Math.max(barW - 1.6, 2.5)}
              height={Math.max(h, 1.5)}
              rx="2"
              fill={isHome ? "var(--pitch)" : "var(--sol-purple)"}
              opacity={isHover ? 1 : 0.28 + Math.abs(p.value) * 0.6}
            />
          );
        })}

        {/* hover scrubber */}
        {hoverMin && (
          <line
            x1={(hoverMin - 0.5) * barW}
            y1="4"
            x2={(hoverMin - 0.5) * barW}
            y2={H - 4}
            stroke="var(--foreground)"
            strokeWidth="1"
            opacity="0.35"
          />
        )}

        {/* goal markers */}
        {points
          .filter((p) => p.goal)
          .reduce((acc, p) => {
            // Group goals by minute to detect overlaps
            const existing = acc.find((g) => g.p.minute === p.minute && g.p.goal === p.goal);
            if (existing) {
              existing.count++;
            } else {
              acc.push({ p, count: 1 });
            }
            return acc;
          }, [] as Array<{ p: typeof points[0]; count: number }>)
          .map((g) => {
            const x = (g.p.minute - 1) * barW + barW / 2;
            const baseY = g.p.goal === "home" ? 16 : H - 16;
            // Offset overlapping goals horizontally (±8px per duplicate)
            const offset = g.count > 1 ? ((g.count - 1) * 8) % 16 - 8 : 0;
            return (
              <g key={`g${g.p.minute}${g.p.goal}`}>
                <circle cx={x + offset} cy={baseY} r="10" fill="var(--background)" stroke="var(--accent)" strokeWidth="1.5" />
                <text x={x + offset} y={baseY + 4} textAnchor="middle" fontSize="11">⚽</text>
              </g>
            );
          })}
      </svg>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-muted">
        <span>1&rsquo;</span>
        <span>HT</span>
        <span>90&rsquo;</span>
      </div>
    </section>
  );
}
