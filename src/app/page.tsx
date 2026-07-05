"use client";

import Link from "next/link";
import { Reveal } from "@/components/landing/Reveal";
import { Flag } from "@/components/match/Flag";

const TEAMS: { iso: string; code: string }[] = [
  { iso: "ar", code: "ARG" }, { iso: "br", code: "BRA" }, { iso: "fr", code: "FRA" },
  { iso: "es", code: "ESP" }, { iso: "gb-eng", code: "ENG" }, { iso: "pt", code: "POR" },
  { iso: "nl", code: "NED" }, { iso: "de", code: "GER" }, { iso: "us", code: "USA" },
  { iso: "mx", code: "MEX" }, { iso: "hr", code: "CRO" }, { iso: "ma", code: "MAR" },
  { iso: "jp", code: "JPN" }, { iso: "be", code: "BEL" }, { iso: "uy", code: "URU" },
  { iso: "co", code: "COL" },
];

export default function Landing() {
  return (
    <div className="relative">
      {/* ================= HERO — video + 3D football ================= */}
      <section className="relative flex h-[100svh] min-h-[660px] items-center justify-center overflow-hidden">
        {/* layer 1: real stadium footage */}
        <video
          className="video-bg"
          src="/videos/stadium-night.mp4"
          autoPlay
          muted
          loop
          playsInline
        />
        <div className="video-veil" />

        {/* type — centered over the stadium, clean and open */}
        <div className="pointer-events-none relative z-10 mx-auto w-full max-w-4xl px-6 text-center">
          <div>
            <div className="reveal mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-1.5 text-xs text-ice backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-sol-teal" />
              Powered by TxLINE · Verified on Solana
            </div>
            <h1 className="text-display text-5xl font-extrabold sm:text-7xl lg:text-8xl">
              <span className="gradient-text">The beautiful game,</span>
              <br />
              provably fair.
            </h1>
            <p className="reveal mx-auto mt-6 max-w-xl text-base text-foreground/80 sm:text-lg">
              Live World Cup data straight from the pitch. Predictions locked on Solana before
              kickoff — hashed, timestamped, and impossible to cheat.
            </p>
            <div className="reveal pointer-events-auto mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/matches"
                className="rounded-full bg-pitch px-7 py-3.5 text-sm font-semibold text-background transition-transform hover:scale-105"
              >
                Watch live matches
              </Link>
              <Link
                href="/predict"
                className="rounded-full border border-white/15 bg-black/30 px-7 py-3.5 text-sm font-semibold backdrop-blur transition-colors hover:bg-white/10"
              >
                Make a prediction →
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-xs text-muted">
          <span className="float-y inline-block">scroll to explore ↓</span>
        </div>
      </section>

      {/* ================= FLAGS MARQUEE ================= */}
      <div className="relative border-y border-border/50 bg-surface/30 py-4 backdrop-blur-sm">
        <div className="flex w-max marquee items-center gap-10">
          {[...TEAMS, ...TEAMS].map((t, i) => (
            <Flag key={i} iso={t.iso} code={t.code} className="h-6 w-9 opacity-75" />
          ))}
        </div>
      </div>

      {/* ================= EDITORIAL FEATURES — open rows ================= */}
      <section className="mx-auto max-w-6xl space-y-24 px-6 py-24">
        {[
          {
            k: "01",
            tag: "Live data",
            title: "Straight from the pitch",
            body: "Scores, 1X2 odds and momentum for every match, streamed from TxODDS' TxLINE feed as the primary input. Sub-100ms when it matters most.",
            accent: "text-pitch",
          },
          {
            k: "02",
            tag: "Provably fair",
            title: "Locked before kickoff",
            body: "Your pick is hashed, signed and anchored on Solana the moment you commit. Timestamped, immutable, impossible to back-date. That's the whole game.",
            accent: "text-sol-teal",
          },
          {
            k: "03",
            tag: "Trustless",
            title: "Verify anything, trust no one",
            body: "Every result carries a Merkle-root anchor published to Solana. One tap opens the explorer — audit the data yourself, no permission needed.",
            accent: "text-ice",
          },
        ].map((f, i) => (
          <Reveal key={f.k}>
            <div
              className={`group flex flex-col gap-6 md:flex-row md:items-end md:gap-14 ${i % 2 ? "md:flex-row-reverse" : ""}`}
            >
              <div className="text-display text-7xl font-extrabold text-muted/15 transition-all duration-500 group-hover:scale-110 group-hover:text-pitch/40 group-hover:drop-shadow-[0_0_30px_rgba(26,209,122,0.35)] sm:text-8xl">
                {f.k}
              </div>
              <div className="max-w-xl">
                <div className={`text-xs font-semibold uppercase tracking-[0.25em] ${f.accent}`}>
                  {f.tag}
                </div>
                <h3 className="text-display mt-3 text-3xl font-bold sm:text-4xl">{f.title}</h3>
                <p className="mt-4 text-base leading-relaxed text-muted">{f.body}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </section>

      {/* ================= VIDEO STRIP — the kick ================= */}
      <section className="relative overflow-hidden py-8">
        <Reveal>
          <div className="relative mx-auto h-[46svh] min-h-[320px] max-w-6xl overflow-hidden rounded-[2rem]">
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src="/videos/ball-kick.mp4"
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/30 to-transparent" />
            <div className="absolute inset-0 flex items-center px-8 sm:px-14">
              <div className="max-w-md">
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">
                  Compete
                </div>
                <h3 className="text-display mt-3 text-3xl font-bold sm:text-4xl">
                  Bold calls, bigger points.
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-foreground/75">
                  Odds-weighted scoring rewards courage — call the upset and bank the multiplier.
                  Streaks, accuracy, and a global leaderboard where every point is backed by proof.
                </p>
                <Link
                  href="/leaderboard"
                  className="mt-5 inline-block text-sm font-semibold text-pitch hover:underline"
                >
                  See the leaderboard →
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ================= HOW IT WORKS — open flow ================= */}
      <section className="mx-auto max-w-4xl px-6 py-24">
        <Reveal>
          <h2 className="text-display mb-14 text-center text-3xl font-bold sm:text-5xl">
            Three touches to <span className="gradient-text">glory</span>
          </h2>
        </Reveal>
        <div className="relative space-y-14">
          <div className="absolute bottom-4 left-[1.05rem] top-4 w-px bg-gradient-to-b from-pitch/60 via-sol-purple/40 to-transparent sm:left-1/2" />
          {[
            { step: "1", title: "Pick a match", body: "Browse live and upcoming fixtures with real-time TxLINE odds." },
            { step: "2", title: "Lock it on-chain", body: "Choose your outcome — we anchor its hash on Solana instantly. No wallet, no gas." },
            { step: "3", title: "Auto-settle & climb", body: "Verified results grade your pick the moment the whistle blows." },
          ].map((s, i) => (
            <Reveal key={s.step} delay={i * 0.08}>
              <div className={`relative flex items-start gap-6 sm:w-1/2 ${i % 2 ? "sm:ml-auto sm:pl-10" : "sm:pr-10 sm:text-right sm:[&>div:last-child]:items-end"}`}>
                <div className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pitch font-mono text-sm font-bold text-background sm:absolute sm:left-1/2 sm:hidden">
                  {s.step}
                </div>
                <div className="flex flex-col">
                  <h3 className="text-display text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 max-w-sm text-sm text-muted">{s.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="relative px-6 pb-32 pt-8 text-center">
        <Reveal>
          <h2 className="text-display mx-auto max-w-3xl text-4xl font-extrabold sm:text-6xl">
            Call it. <span className="text-pitch">Prove it.</span> Own it.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-muted">
            The World Cup only comes around every four years. Make your calls count — and make
            them provable.
          </p>
          <Link
            href="/predict"
            className="sol-gradient mt-9 inline-block rounded-full px-9 py-4 text-sm font-semibold text-background transition-transform hover:scale-105"
          >
            Start predicting
          </Link>
        </Reveal>
      </section>

    </div>
  );
}
