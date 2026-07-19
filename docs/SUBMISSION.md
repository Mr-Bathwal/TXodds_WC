# MatchPulse ⚽⛓ — Technical Documentation

> **The World Cup second screen where every number can prove itself.**
>
> A live match companion built on **TxODDS TxLINE** real-time data, with
> Solana-anchored data integrity, cryptographically provable predictions,
> gas-less on-chain commitments, real SOL payouts, and an instant Telegram pundit.

| | |
|---|---|
| **🌐 Live app** | **https://t-xodds-wc.vercel.app** |
| **💻 Public repo** | **https://github.com/Mr-Bathwal/TXodds_WC** |
| **🎥 Demo video** | `<VIDEO_URL>` |
| **🏆 Track** | World Cup — Consumer & Fan Experiences |
| **⛓ Chain** | Solana **devnet** — Memo program (commitments) + SystemProgram (SOL payouts) |
| **🔗 On-chain proof** | devnet program `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| **📅 Built for** | TxODDS × Solana World Cup Hackathon |

---

## 0 · Executive summary — *why MatchPulse wins*

Most "sports + crypto" projects bolt a wallet onto a scoreboard. MatchPulse does
the opposite: it takes the one thing TxODDS already does that **nobody else in
sports data does — publishing a Merkle root of every data batch to Solana — and
turns it into a fan-facing product feature.** The result is a mainstream-grade
live match centre where the *data*, the *odds*, and the *fan's own predictions*
are all independently verifiable on-chain.

It is **not a mockup.** It streams real TxLINE data through five endpoints,
reconstructs a broadcast-grade match centre server-side, and closes a full
on-chain loop: sign-in → predict → commit (gas-less) → settle → **claim real
devnet SOL**. Every screen in the demo is the live product.

**One line:** *SofaScore-grade live experience + Polymarket-grade commitment
integrity, running on TxODDS rails.*

### Judging-criteria scorecard

| Criterion | How MatchPulse scores | Proof in product |
|---|---|---|
| **Fan Accessibility & UX** | Zero-wallet, zero-jargon browsing; the chain is invisible until it helps. Polished Three.js / motion UI a non-crypto fan opens for the match, not the tech. | `/matches`, `/match/[id]` — no sign-up wall |
| **Real-Time Responsiveness** | 2.5 s server cache while live + SWR 4–5 s polling; scoreboard, clock, timeline and an **odds-derived momentum chart** move with the game. | Live scoreboard + momentum chart = real TxLINE odds time-series |
| **Originality & Value Creation** | First fan product to **surface TxLINE's on-chain Merkle proof** + provable pre-kickoff predictions. A genuinely new interaction model, not a repackaged feed. | "Verified on-chain" badge → Solana Explorer |
| **Commercial & Monetization Path** | Distribution is pre-solved (TxODDS' existing B2B clients), 4 revenue lines on one codebase, near-zero marginal cost, sport-agnostic scale. | §7 |
| **Completeness & Execution** | End-to-end loop live today incl. real SOL payout; honest provenance labels; no fake data. | Predict → commit → settle → **Sign & Claim SOL** |
| **Requirement: TxLINE as live input** | 5 endpoints, decoded server-side into the entire experience. | §2 |
| **Requirement: sign up through Solana** | The predict CTA *is* the wallet connect; picks are wallet-signed. | §4 |

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
| 5 | `GET /api/fixtures/validation?fixtureId={id}` | **The differentiator.** Merkle root + proof path for the fixture's data batch → the in-app "Verified on-chain" badge with Solana Explorer click-through. |

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

A rule we set ourselves: **never present synthetic data as real.**

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
  over the claim message before any transfer leaves the relayer, plus a
  per-payout cap so the relayer can't be drained.
- **Wallet-gated predictions**: the predict button *is* the
  `WalletMultiButton` until a wallet is connected — sign-up **through Solana**.
- **Verification without re-hashing**: fans don't have to trust *us* to trust the
  data — the Merkle root is TxODDS', already on-chain; we just make it clickable.

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
| `/match/[id]` | Scoreboard + clock · play-by-play timeline (leader-stem markers, never overlapping) · **odds-derived momentum chart** · stats panel with provenance labels · head-to-head · **3D tilting pitch** with real formation grid + player photos · venue/weather/pitch context · **Verified on-chain badge** |
| Predict panel | 1X2 + Over/Under 2.5 · live de-margined odds · bankroll & custom stakes · wallet-signed, relayer-anchored commitments with explorer links; finished matches show a **settled, read-only market** (winner/loser resolved at the locked odds) |
| `/predict` | Open positions, settled results at odds-at-commit |
| `/leaderboard` | Ranked podium (confetti!), surplus → **Sign & Claim devnet SOL** |
| Telegram | Instant pundit messages on match events |

**Stack:** Next.js 16 (Turbopack) · React 19 · Tailwind v4 · Three.js/R3F ·
GSAP + Motion · SWR · `@solana/web3.js` + wallet-adapter · tweetnacl · bs58.

---

## 7 · Commercial & scalability path — *built to lead, not just to demo*

MatchPulse is engineered so the **hardest problem for any consumer app —
distribution — is already solved**, and the economics stay healthy at scale.

### 7.1 Distribution moat (why we don't have a cold-start problem)

TxODDS already licenses TxLINE to **hundreds of sportsbooks, broadcasters and
rights holders**. Those partners are perennially short of *fan-retention
surfaces* — polished second-screen experiences that keep users engaged around
their own data. MatchPulse is exactly that surface, white-label-ready.
**TxODDS' existing B2B clients are our go-to-market channel and our customers on
day one** — a new upsell layer on top of the feed business, not a new audience
to acquire from scratch.

### 7.2 Four revenue lines on one codebase

| Line | Model | Who pays |
|---|---|---|
| **B2B white-label licence** | Per-operator SaaS (branding, domains, feature flags) | Books / broadcasters / federations |
| **Affiliate & rev-share** | Warm hand-off from the odds surface & prediction habit loop to licensed operators | Regulated sportsbooks |
| **"Proof" trust product** | The on-chain Verified-data badge sold as a premium, marketable integrity feature | Operators competing on trust |
| **Sponsored predictions / branded leaderboards** | Sponsored markets, branded podiums, premium multi-league TTS pundit subscription | Brands + power fans |

### 7.3 Unit economics & scale

- **Marginal cost ≈ zero.** A server-side cache (2.5 s live TTL) absorbs read
  fan-out, so 1 user and 100k users hit TxLINE at nearly the same rate. The
  gas-less relayer batches commitments onto Solana, where fees are a **fraction
  of a cent** — anchoring *millions* of predictions doesn't break the model.
- **Sport- and league-agnostic.** The exact same decoding pipeline runs *any*
  competition TxODDS covers. World Cup → year-round product (domestic leagues,
  other sports) with **zero re-architecture** — the tournament is the wedge,
  not the ceiling.
- **Defensible.** The trust layer rides TxODDS' own on-chain publishing, so it
  can't be cloned without the data partnership — the moat is structural.
- **Retention flywheel.** Provable leaderboards + the zero-cost Telegram pundit
  drive habitual match-day returns and a natural viral loop (shareable,
  verifiable picks).

### 7.4 Differentiation vs. the field

| | Generic score app | Web3 betting dapp | **MatchPulse** |
|---|---|---|---|
| Real licensed live data | ✅ | ⚠️ scraped | ✅ **TxLINE** |
| Data you can verify on-chain | ❌ | ❌ | ✅ **Merkle proof surfaced** |
| Predictions provably locked pre-event | ❌ | ⚠️ on-chain but costly | ✅ **gas-less commit** |
| Mainstream, no-wallet-first UX | ✅ | ❌ | ✅ |
| Distribution ready | — | cold start | ✅ **TxODDS clients** |

---

## 8 · Honest limits (what we'd build next)

- Settlement is client-triggered against TxLINE finalisation; a cron-driven
  settlement worker is the production next step.
- The enrichment cache is in-process; Redis/KV would harden it on serverless.
- Reveal-phase verification (publishing the pre-image of a commitment after
  settlement) is designed but not yet surfaced in the UI.
- Points/SOL economy is a devnet demo; mainnet requires the usual custody,
  compliance and regulated-market gating (deliberately out of hackathon scope).

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

## 10 · Repository map (for reviewers)

| Path | What's there |
|---|---|
| `src/lib/txline/` | TxLINE client, auth, snapshot decoding, score reconstruction — the data engine |
| `src/lib/solana/` | Commitment hashing, relayer, identity, on-chain verification |
| `src/app/api/` | `commit`, `claim`, `fixtures`, `webhooks/txline` route handlers |
| `src/components/match/` | Scoreboard, timeline, momentum chart, stats, 3D pitch |
| `src/components/predict/` | Wallet-gated prediction market & receipts |
| `docs/SUBMISSION.md` | This document |

---

*Built with ❤️ (and a 2.5-second cache TTL) for the TxODDS × Solana World Cup
Hackathon — Consumer & Fan Experiences track.*
