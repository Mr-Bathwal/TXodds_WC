"use client";

import { useMemo, useRef, useState } from "react";
import type { Fixture } from "@/lib/txline";
import { computeLineup, type PlayerSlot } from "@/lib/lineups";
import { Flag } from "./Flag";

/**
 * Lineups — a wide horizontal grass pitch in 3D: home XI builds from the left
 * goal, away XI mirrored from the right, viewed from the stands (CSS
 * perspective tilt that leans with the cursor). Hovering a player enlarges the
 * dot and prints a readout under the pitch.
 */

const W = 1000;
const H = 600;

function ratingTone(r: number): string {
  if (r >= 8) return "var(--sol-teal)";
  if (r >= 7) return "var(--pitch)";
  if (r >= 6.4) return "var(--gold)";
  return "var(--danger)";
}

interface DotPos {
  p: PlayerSlot;
  x: number;
  y: number;
  side: "home" | "away";
}

/** Horizontal layout: rows advance along X from each goal; p.x spreads on Y. */
function layout(players: PlayerSlot[], side: "home" | "away", rows: number): DotPos[] {
  return players.map((p) => {
    const depth = (p.row + 0.7) / (rows + 0.9);
    const x = side === "home" ? depth * (W / 2 - 60) + 40 : W - (depth * (W / 2 - 60) + 40);
    const y = (side === "home" ? p.x : 100 - p.x) * ((H - 90) / 100) + 45;
    return { p, x, y, side };
  });
}

export function LineupPitch({ fixture }: { fixture: Fixture }) {
  const home = useMemo(() => computeLineup(fixture, "home"), [fixture]);
  const away = useMemo(() => computeLineup(fixture, "away"), [fixture]);
  const predicted = fixture.status === "scheduled";
  const [hover, setHover] = useState<DotPos | null>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  // Real lineups (shirt numbers) from TxLINE take over the formation slots; the
  // fabricated names/ratings are dropped so only real data shows.
  const realLU = predicted ? undefined : fixture.live?.lineup;
  const overlay = (players: PlayerSlot[], real?: { number: number }[]) =>
    real && real.length
      ? players.map((p, i) => ({ ...p, number: real[i]?.number ?? p.number, name: "", rating: 0, star: false }))
      : players;
  const homePlayers = overlay(home.players, realLU?.home);
  const awayPlayers = overlay(away.players, realLU?.away);

  const dots = [
    ...layout(homePlayers, "home", home.rows),
    ...layout(awayPlayers, "away", away.rows),
  ];

  function onMove(e: React.MouseEvent) {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${22 - py * 8}deg) rotateY(${px * 6}deg)`;
  }
  function onLeave() {
    if (tiltRef.current) tiltRef.current.style.transform = "rotateX(22deg) rotateY(0deg)";
    setHover(null);
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Flag iso={fixture.home.iso} code={fixture.home.code} className="h-6 w-9" />
          <span className="text-display text-lg font-bold">{fixture.home.name}</span>
          <span className="font-mono text-sm text-pitch">{home.formation}</span>
        </div>
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted">
          {predicted ? "Predicted lineups" : "Lineups"}
          {realLU && (
            <span className="flex items-center gap-1 rounded-full border border-pitch/30 bg-pitch/5 px-2 py-0.5 text-[10px] normal-case tracking-normal text-pitch">
              <span className="live-dot h-1 w-1 rounded-full bg-pitch" /> real · TxLINE
            </span>
          )}
        </h2>
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-sol-purple">{away.formation}</span>
          <span className="text-display text-lg font-bold">{fixture.away.name}</span>
          <Flag iso={fixture.away.iso} code={fixture.away.code} className="h-6 w-9" />
        </div>
      </div>

      {/* 3D stage — wide pitch viewed from the stands */}
      <div style={{ perspective: "1500px" }} onMouseMove={onMove} onMouseLeave={onLeave}>
        <div
          ref={tiltRef}
          className="mx-auto w-full transition-transform duration-300 ease-out will-change-transform"
          style={{ transform: "rotateX(22deg)", transformStyle: "preserve-3d" }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full drop-shadow-[0_40px_70px_rgba(0,0,0,0.6)]"
            role="img"
            aria-label="Team formations on pitch"
          >
            <defs>
              <linearGradient id="grassH" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="color-mix(in srgb, var(--pitch) 30%, #06130b)" />
                <stop offset="50%" stopColor="color-mix(in srgb, var(--pitch) 17%, #06130b)" />
                <stop offset="100%" stopColor="color-mix(in srgb, var(--pitch) 30%, #06130b)" />
              </linearGradient>
              <radialGradient id="spotH" cx="50%" cy="45%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>

            <rect x="2" y="2" width={W - 4} height={H - 4} rx="20" fill="url(#grassH)" />
            <rect x="2" y="2" width={W - 4} height={H - 4} rx="20" fill="url(#spotH)" />
            {/* vertical mowing stripes */}
            {Array.from({ length: 12 }).map((_, i) => (
              <rect key={i} x={2 + i * ((W - 4) / 12)} y="2" width={(W - 4) / 12} height={H - 4}
                fill={i % 2 ? "#ffffff" : "transparent"} opacity={0.025} />
            ))}

            {/* pitch lines */}
            <g stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none">
              <rect x="18" y="18" width={W - 36} height={H - 36} rx="12" />
              <line x1={W / 2} y1="18" x2={W / 2} y2={H - 18} />
              <circle cx={W / 2} cy={H / 2} r="64" />
              <circle cx={W / 2} cy={H / 2} r="3" fill="rgba(255,255,255,0.35)" />
              {/* left box */}
              <rect x="18" y={H / 2 - 110} width="72" height="220" />
              <rect x="18" y={H / 2 - 50} width="30" height="100" />
              {/* right box */}
              <rect x={W - 90} y={H / 2 - 110} width="72" height="220" />
              <rect x={W - 48} y={H / 2 - 50} width="30" height="100" />
            </g>

            {/* players */}
            {dots.map((d) => {
              const isHover = hover?.p === d.p && hover.side === d.side;
              const fill = d.side === "home" ? "var(--pitch)" : "var(--sol-purple)";
              return (
                <g
                  key={`${d.side}${d.p.number}`}
                  onMouseEnter={() => setHover(d)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                >
                  {d.p.star && (
                    <circle cx={d.x} cy={d.y} r={21} fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="4 4" />
                  )}
                  <circle cx={d.x} cy={d.y} r={isHover ? 20 : 15.5} fill={fill} opacity={0.95}
                    style={{ transition: "r 0.15s" }} />
                  <text x={d.x} y={d.y + 4.5} textAnchor="middle" fontSize={isHover ? 14 : 12} fontWeight="700" fill="var(--background)">
                    {d.p.number}
                  </text>
                  <text x={d.x} y={d.y + 36} textAnchor="middle" fontSize="12" fill="#fff" opacity={0.9}>
                    {d.p.name}
                  </text>
                  {d.p.rating > 0 && (
                    <g>
                      <rect x={d.x + 12} y={d.y - 30} width={34} height={17} rx={5} fill={ratingTone(d.p.rating)} />
                      <text x={d.x + 29} y={d.y - 17.5} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--background)">
                        {d.p.rating.toFixed(1)}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* hover readout */}
      <div className="mt-6 flex h-6 items-center justify-center font-mono text-sm">
        {hover ? (
          <span>
            <span className={hover.side === "home" ? "text-pitch" : "text-sol-purple"}>
              #{hover.p.number} {hover.p.name}
            </span>
            <span className="text-muted"> · {hover.p.role}</span>
            {hover.p.rating > 0 && (
              <span style={{ color: ratingTone(hover.p.rating) }}> · {hover.p.rating.toFixed(1)}</span>
            )}
            {hover.p.star && <span className="text-gold"> · ★ best on pitch</span>}
          </span>
        ) : (
          <span className="text-xs text-muted/60">
            hover a player · ★ dashed ring = highest-rated on the pitch
          </span>
        )}
      </div>
    </section>
  );
}
