"use client";

import { useMemo, useRef, useState } from "react";
import type { Fixture } from "@/lib/txline";
import { computeLineup, type PlayerSlot } from "@/lib/lineups";
import { Flag } from "./Flag";

/**
 * Lineups — a large grass pitch rendered in 3D: the field lies back at an
 * angle (CSS perspective) and leans with the cursor, players enlarge on hover
 * with a name/rating readout. Open layout, no card chrome — the pitch IS the
 * section.
 */

const W = 560;
const H = 760;

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

function layout(players: PlayerSlot[], side: "home" | "away", rows: number): DotPos[] {
  return players.map((p) => {
    const depth = (p.row + 0.7) / (rows + 0.9);
    const y = side === "home" ? depth * (H / 2 - 40) + 26 : H - (depth * (H / 2 - 40) + 26);
    const x = (side === "home" ? p.x : 100 - p.x) * ((W - 40) / 100) + 20;
    return { p, x, y, side };
  });
}

export function LineupPitch({ fixture }: { fixture: Fixture }) {
  const home = useMemo(() => computeLineup(fixture, "home"), [fixture]);
  const away = useMemo(() => computeLineup(fixture, "away"), [fixture]);
  const predicted = fixture.status === "scheduled";
  const [hover, setHover] = useState<DotPos | null>(null);
  const tiltRef = useRef<HTMLDivElement>(null);

  const dots = useMemo(
    () => [...layout(home.players, "home", home.rows), ...layout(away.players, "away", away.rows)],
    [home, away],
  );

  function onMove(e: React.MouseEvent) {
    const el = tiltRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${16 - py * 7}deg) rotateY(${px * 8}deg)`;
  }
  function onLeave() {
    if (tiltRef.current) tiltRef.current.style.transform = "rotateX(16deg) rotateY(0deg)";
    setHover(null);
  }

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
          {predicted ? "Predicted lineups" : "Lineups"}
        </h2>
        <div className="flex items-center gap-6 font-mono text-xs text-muted">
          <span className="flex items-center gap-2">
            <Flag iso={fixture.home.iso} code={fixture.home.code} className="h-3.5 w-5" />
            {fixture.home.code} <span className="text-pitch">{home.formation}</span>
          </span>
          <span className="flex items-center gap-2">
            <Flag iso={fixture.away.iso} code={fixture.away.code} className="h-3.5 w-5" />
            {fixture.away.code} <span className="text-sol-purple">{away.formation}</span>
          </span>
        </div>
      </div>

      {/* 3D stage */}
      <div style={{ perspective: "1300px" }} onMouseMove={onMove} onMouseLeave={onLeave}>
        <div
          ref={tiltRef}
          className="mx-auto w-full max-w-xl transition-transform duration-300 ease-out will-change-transform"
          style={{ transform: "rotateX(16deg)", transformStyle: "preserve-3d" }}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full drop-shadow-[0_36px_60px_rgba(0,0,0,0.55)]"
            role="img"
            aria-label="Team formations on pitch"
          >
            <defs>
              <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="color-mix(in srgb, var(--pitch) 30%, #06130b)" />
                <stop offset="50%" stopColor="color-mix(in srgb, var(--pitch) 18%, #06130b)" />
                <stop offset="100%" stopColor="color-mix(in srgb, var(--pitch) 30%, #06130b)" />
              </linearGradient>
              <radialGradient id="spot" cx="50%" cy="50%" r="70%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.10)" />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>

            {/* grass + floodlight sheen */}
            <rect x="2" y="2" width={W - 4} height={H - 4} rx="18" fill="url(#grass)" />
            <rect x="2" y="2" width={W - 4} height={H - 4} rx="18" fill="url(#spot)" />
            {/* mowing stripes */}
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={i} x="2" y={2 + i * ((H - 4) / 10)} width={W - 4} height={(H - 4) / 10}
                fill={i % 2 ? "#ffffff" : "transparent"} opacity={0.025} />
            ))}

            {/* pitch lines */}
            <g stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none">
              <rect x="14" y="14" width={W - 28} height={H - 28} rx="10" />
              <line x1="14" y1={H / 2} x2={W - 14} y2={H / 2} />
              <circle cx={W / 2} cy={H / 2} r="58" />
              <circle cx={W / 2} cy={H / 2} r="3" fill="rgba(255,255,255,0.35)" />
              <rect x={W / 2 - 100} y="14" width="200" height="64" />
              <rect x={W / 2 - 44} y="14" width="88" height="26" />
              <rect x={W / 2 - 100} y={H - 78} width="200" height="64" />
              <rect x={W / 2 - 44} y={H - 40} width="88" height="26" />
            </g>

            {/* players */}
            {dots.map((d) => {
              const isHover = hover?.p === d.p;
              const fill = d.side === "home" ? "var(--pitch)" : "var(--sol-purple)";
              return (
                <g
                  key={`${d.side}${d.p.number}`}
                  onMouseEnter={() => setHover(d)}
                  onMouseLeave={() => setHover(null)}
                  className="cursor-pointer"
                >
                  {d.p.star && (
                    <circle cx={d.x} cy={d.y} r={20} fill="none" stroke="var(--gold)" strokeWidth="2" strokeDasharray="4 4" />
                  )}
                  <circle cx={d.x} cy={d.y} r={isHover ? 19 : 15} fill={fill} opacity={0.95}
                    style={{ transition: "r 0.15s" }} />
                  <text x={d.x} y={d.y + 4.5} textAnchor="middle" fontSize={isHover ? 14 : 12} fontWeight="700" fill="var(--background)">
                    {d.p.number}
                  </text>
                  <text x={d.x} y={d.y + 34} textAnchor="middle" fontSize="11.5" fill="#fff" opacity={0.9}
                    style={{ textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                    {d.p.name}
                  </text>
                  {d.p.rating > 0 && (
                    <g>
                      <rect x={d.x + 11} y={d.y - 28} width={32} height={16} rx={5} fill={ratingTone(d.p.rating)} />
                      <text x={d.x + 27} y={d.y - 16} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="var(--background)">
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

      {/* hover readout under the pitch */}
      <div className="mt-5 flex h-6 items-center justify-center font-mono text-sm">
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
