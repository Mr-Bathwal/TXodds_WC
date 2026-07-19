# MatchPulse ⚽⛓ — Technical Documentation

> **The World Cup second screen where every number can prove itself.**
>
> A live match companion built on **TxODDS TxLINE** real-time data, with
> Solana-anchored data integrity, cryptographically provable predictions,
> gas-less on-chain commitments, SOL payouts, and an instant Telegram pundit.

| | |
|---|---|
| **Live app** | https://t-xodds-wc.vercel.app |
| **Public repo** | https://github.com/Mr-Bathwal/TXodds_WC |
| **Demo video** | `<VIDEO_URL>` |
| **Track** | World Cup — Consumer & Fan Experiences |
| **Chain** | Solana **devnet** (Memo program + SystemProgram transfers) |

---

## 1 · Core idea

Fans consume live football through a stack of feeds they cannot audit: a score
appears, odds move, a bet settles — and every step is *"trust us."*

TxODDS already solves the hardest part: TxLINE publishes a **Merkle root of every
data batch to Solana**. But no fan-facing product has ever surfaced it.

**MatchPulse makes the trust layer a product feature.** It is a polished,
mainstream-fan match centre where:

1. **The data proves itself** — every match carries a "Verified on-chain" badge
   that opens the batch's Merkle root, proof depth, and the Solana Explorer
   transaction. The score is tamper-evident, not take-our-word-for-it.
2. **Your predictions prove themselves** — picks are hashed (SHA-256 over a
   canonical serialization), signed by the fan's wallet, and anchored to
   Solana's Memo program *before kickoff* by a gas-less relayer. Nobody — not
   even us — can rewrite a pick after the goal goes in.
3. **Payouts are real** — settled winnings are claimable as devnet SOL via a
   signature-verified relayer transfer.

One sentence: *SofaScore-grade live experience + Polymarket-grade
commitment integrity, on TxODDS rails.*

---

## 2 · TxLINE endpoints used (live input)

All requests authenticated with `Authorization: Bearer <guest JWT>` +
`X-Api-Token`. Implementation: `src/lib/txline/live.ts`.

| # | Endpoint | How MatchPulse uses it |
|---|----------|------------------------|
| 1 | `POST /auth/guest/start` | Guest JWT bootstrap. Single-flight (one auth call shared across a cold-start fan-out), auto-refresh every 10 min, transparent 401-retry. |
| 2 | `GET /api/fixtures/snapshot?competitionId={c}&startEpochDay={d}` | Fixture discovery. Fanned out across competitions × {yesterday, today, tomorrow}, deduped by `FixtureId`; `Participant1IsHome` drives home/away mapping. |
| 3 | `GET /api/odds/snapshot/{fixtureId}` | De-margined 1X2 (`Pct` triplets). Latest snapshot → the odds board & stake payouts; the **full time-series** → re-normalised implied-probability history that drives the live **momentum chart** (the market's heartbeat, not an animation). |
| 4 | `GET /api/scores/snapshot/{fixtureId}` | The workhorse. We decode the action stream — `kickoff`, `goal`, `corner`, `yellow/red`, `substitution` (PlayerIn/Out), `var`, `possession`/`high_danger_possession`, `free_kick`, `lineups`, `weather`/`pitch`/`venue`, `Clock`, `halftime_finalised`, `game_finalised` — into scoreboard, match clock, play-by-play timeline, real starting XIs, live stats and venue context. |
| 5 | `GET /api/fixtures/validation?fixtureId={id}` | **The differentiator.** Merkle root + proof path for the fixture's data batch → the in-app "Verified on-chain" badge with Solana Explorer click-through (devnet program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`). |

### Engineering the snapshot feed (technical highlights)

The snapshot API is *thinned* — it keeps only the **latest event per action
type**, and only Goals + Corners are cumulative (with a real H1/HT/H2 split).
Naively polling it loses history. MatchPulse:

- **Accumulates per-fixture score history across polls** (`mergeScoreHistory`)
  so the reconstruction never resets — the timeline survives feed thinning.
- **Derives match status from actions + Clock** (`kickoff`,
  `halftime_finalised`, `game_finalised`), because `GameState` proved
  unreliable in practice.
- **Time-weights possession** using event timestamps rather than counting
  snapshots, so rapid event bursts can't spike possession to 100%.
- **Handles VAR disallowals**: goal totals are allowed to *decrease*, and the
  most recent goal event is retroactively removed from the timeline.
- **Tracks the active XI** by applying `substitution` (PlayerInId/PlayerOutId)
  deltas to the confirmed starting lineups.
- Caches server-side at **2.5 s TTL while any match is live** (20 s otherwise);
  clients poll via SWR every 4–5 s. Real-time, without hammering the API.

---

## 3 · Data honesty by design

A hackathon rule we set ourselves: **never present synthetic data as real.**

Every `LiveDetail` payload carries a provenance tag rendered in the UI:

| Source label | Meaning |
|---|---|
| `api-football` | Real third-party match detail (statistics, events, lineups with player photos), fuzzy-matched to the TxLINE fixture and fetched under a strict 100-req/day budget with per-endpoint TTL caching (live 5 min · finished 12 h · lineups 12 h · daily list 24 h). |
| `txline` | Decoded directly from the TxLINE live stream. |
| `synth` | Deterministic, score-consistent **estimate**, used only when neither source can provide the number — and labelled "estimated" on screen. |

TxLINE remains the source of truth for score, clock, odds and verification at
all times; enrichment only ever *adds* detail, never overrides the feed.

---

## 4 · Solana architecture

```
 fan browser                     Next.js server (Vercel)                Solana devnet
┌───────────────┐   sign msg   ┌──────────────────────────┐   Memo tx  ┌─────────────┐
│ wallet-adapter │────────────▶│ /api/commit               │──────────▶│ Memo program │
│ (Phantom etc.) │             │  nacl.verify(author,sig)  │           │  mp1:<hash>… │
│                │             │  SHA-256(commitment)      │           └─────────────┘
│ pick + stake   │             │  relayer signs & pays fee │
└───────────────┘             └──────────────────────────┘
        │                              │
        │  sign "claim" msg            │ SystemProgram.transfer
        ▼                              ▼
   /api/claim ── nacl.verify ──▶ devnet SOL → fan wallet

 TxLINE validation feed ──▶ Merkle root already on-chain ──▶ "Verified on-chain" badge
```

- **Commitment format** (`src/lib/solana/commitment.ts`): canonical string
  `MatchPulse|v1|fixtureId|pick|nonce|createdAt|author` → SHA-256 → memo
  `mp1:<hash>:<author>:<createdAt>`. Tiny on-chain footprint, privacy-preserving
  (the pick itself never goes on-chain), yet provably fixed pre-kickoff.
- **Gas-less UX** (`src/lib/solana/relayer.ts`): the relayer pays fees —
  Polymarket-style frictionless onboarding. Fans sign; they never buy SOL first.
- **Signature-verified claims** (`/api/claim`): tweetnacl `sign.detached.verify`
  over the claim message before any transfer leaves the relayer.
- **Wallet-gated predictions**: the predict button *is* the
  `WalletMultiButton` until a wallet is connected — sign-up **through Solana**.

---

## 5 · The Pundit bot (fan reach beyond the app)

`POST /api/webhooks/txline` accepts TxLINE-shaped match events
(`goal` / `red_card` / momentum) and pushes instant pundit commentary to a
Telegram channel via the Bot API. Deliberately **zero-cost and dependency-free**
(rule-based commentary engine, no external AI API, no latency, no per-message
spend) — and the webhook design is LLM-ready: swap the template layer for a
model call and nothing else changes.

---

## 6 · Product surface (all functional, no mockups)

| Surface | What's real |
|---|---|
| `/` landing | Three.js hero, live data teaser |
| `/matches` | All fixtures, live scores & odds ticking (SWR 5 s) |
| `/match/[id]` | Scoreboard + clock · play-by-play timeline · **odds-derived momentum chart** · stats panel with provenance labels · head-to-head · **3D tilting pitch** with real formation grid + player photos · venue/weather/pitch context · **Verified on-chain badge** |
| Predict panel | 1X2 + Over/Under 2.5 · live de-margined odds · bankroll & custom stakes · wallet-signed, relayer-anchored commitments with explorer links |
| `/predict` | Open positions, settled results at odds-at-commit |
| `/leaderboard` | Ranked podium (confetti!), surplus → **Sign & Claim devnet SOL** |
| Telegram | Instant pundit messages on match events |

**Stack:** Next.js 16 (Turbopack) · React 19 · Tailwind v4 · Three.js/R3F ·
GSAP + Motion · SWR · `@solana/web3.js` + wallet-adapter · tweetnacl · bs58.

---

## 7 · Commercial & monetization path

1. **B2B white-label** — TxODDS' existing customers (books, broadcasters, rights
   holders) need fan-retention surfaces. MatchPulse is a deployable match centre
   that showcases *their* data with verifiable integrity — a new sales layer on
   top of the feed business.
2. **Affiliate conversion** — the odds surface and prediction habit loop are a
   natural licensed-operator funnel in regulated markets.
3. **"Verified data" as premium trust product** — the on-chain badge is a
   marketable differentiator vs. every unverifiable competitor app.
4. **Premium pundit** — the Telegram webhook upgrades to personalised,
   multi-league, TTS-ready commentary as a subscription.
5. **On-chain rails are already live** — points → SOL claims prove the
   wallet-payout loop; the same rails carry real economies post-hackathon.

---

## 8 · Honest limits (what we'd build next)

- Settlement is client-triggered against TxLINE finalisation; a cron-driven
  settlement worker is the production next step.
- The enrichment cache is in-process; Redis/KV would harden it on serverless.
- Reveal-phase verification (publishing the pre-image of a commitment after
  settlement) is designed but not yet surfaced in the UI.

---

## 9 · TxLINE API feedback (requested by the organisers)

**What we loved:**
- **Guest auth is frictionless** — `POST /auth/guest/start` and you're
  streaming in seconds. Best onboarding of any sports API we've used.
- **The validation endpoint is a genuine differentiator** — no other feed hands
  you a Merkle root already anchored on Solana. It's the reason this product
  can exist.
- **The action stream is rich** — clock, lineups, VAR, possession classes,
  weather/pitch/venue. Enough to rebuild a broadcast-grade timeline.
- **Real odds time-series** — de-margined `Pct` history made our momentum chart
  real market data instead of a fake animation.

**Where we hit friction:**
- **Snapshot thinning** — `/api/scores/snapshot` keeps only the *latest* event
  per action type, so a late joiner can't reconstruct the full timeline (e.g.
  3 goals scored, 1 goal event visible). We worked around it by accumulating
  history across polls server-side. A `?since=` cursor or a full-history flag
  would remove that entire class of workaround.
- **`GameState` is unreliable** — we had to derive status from
  `kickoff`/`halftime_finalised`/`game_finalised` actions + `Clock` instead.
- **Cumulative totals only for Goals + Corners** — cumulative counts for shots,
  cards and fouls (like the H1/HT/H2 goal split) would let builders skip
  third-party enrichment entirely.
- **Possession arrives as instantaneous events, not percentages** — we
  time-weighted the events to estimate share; a rolling % would be friendlier.
- A short **action-vocabulary reference** (all `Action` values + `Data` shapes)
  would have saved a day of reverse-engineering.

We'd happily contribute our decoding layer (`src/lib/txline/`) back as a
community TypeScript SDK — it's already typed, documented and provider-agnostic.

---

*Built with ❤️ (and a 2.5-second cache TTL) for the TxODDS × Solana World Cup
Hackathon — Consumer & Fan Experiences track.*
