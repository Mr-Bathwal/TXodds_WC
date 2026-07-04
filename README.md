# ⚽ MatchPulse — the provably-fair World Cup companion

**Live TxLINE match data. Predictions timestamped on Solana. Zero wallets, zero gas, zero cheating.**

Built for the **TxODDS × Solana World Cup Hackathon** (Consumer & Fan Experiences track) on Superteam Earn.

---

## What it is

MatchPulse is a live World Cup 2026 companion app where fans don't just watch — they **call it and prove it**:

1. **Watch** — real-time scores, 1X2 odds, win probability, momentum, stats, lineups and head-to-head for every match, driven by the **TxLINE feed as the primary data input**.
2. **Predict** — pick a result or total-goals line before kickoff. The pick is hashed (SHA-256), signed with the fan's key, and **anchored on Solana** via a relayer — timestamped and immutable.
3. **Prove** — when TxLINE publishes the verified result (Merkle root anchored on Solana by TxODDS), predictions **auto-settle**. Every point on the leaderboard traces back to an on-chain commitment nobody could back-date.

### Why on-chain matters here
Prediction games die when players suspect scores are edited after the fact. MatchPulse makes the core loop *trustless*: the pick's hash lives on Solana before kickoff, the result is TxLINE's cryptographically-verified data, and settlement is deterministic from the two. The "Verified on-chain" badge on every match opens the Solana Explorer — the trust layer is a feature the fan can touch.

## The fan experience

- **Interactive 3D** — a procedurally-textured football under stadium floodlights (React Three Fiber); grab-the-cursor tilt, click to kick. Lineups render on a grass pitch lying back in 3D perspective that leans with your mouse.
- **Open editorial design** — no dashboard boxes: hairline rules, kicker headings, display-size numerals. Goals hang off a 0–90' thread growing out of the scoreboard.
- **Three themes** — Night Match / Turf / Royal, recoloring the UI *and* the WebGL scenes.
- **Zero-friction Web3** — a Solana keypair is created invisibly in the browser (no seed phrase, no extension); a relayer pays fees. Polymarket-style abstraction: the chain is there, the friction isn't.
- **Gamified** — odds-weighted scoring (bold calls pay more), streaks, accuracy, podium leaderboard.

## Architecture

```
Browser (Next.js 16 / React 19 / Tailwind v4)
│  ├─ React Three Fiber scenes (football hero, ambient particles)
│  ├─ In-browser ed25519 identity (tweetnacl) — signs every prediction
│  └─ SWR polling → live UI (scores tick, odds move, picks settle)
│
├─ /api/fixtures            TxLINE data layer (provider-swappable)
│     ├─ live.ts   → txline.txodds.com REST (guest JWT → on-chain TxL
│     │              subscription → API token)   [set TXLINE_API_TOKEN]
│     └─ mock.ts   → deterministic World Cup simulation (demo fallback)
│
└─ /api/commit              Predict & Prove pipeline
      1. verify author signature (nacl)
      2. SHA-256 the canonical commitment
      3. anchor via Solana Memo program on devnet — relayer pays
         [set SOLANA_RELAYER_SECRET; simulated anchors otherwise]
```

**Provider-swappable by design:** the whole UI runs identically on the mock feed (zero-config demo) or the live TxLINE feed — one env var flips it.

## Run it

```bash
npm install
npm run build && npx next start   # production (recommended on Windows)
# or: npm run dev
```

Optional env (`.env.local`):

| Var | Effect |
|---|---|
| `TXLINE_API_TOKEN` | switches fixtures/odds/results to the live TxLINE feed |
| `SOLANA_RELAYER_SECRET` | base58 devnet key — makes anchors real Memo txs on Solana devnet |
| `SOLANA_CLUSTER` / `SOLANA_RPC` | cluster overrides (default devnet) |

## Credits

- Match data: **TxODDS TxLINE** (fixtures, odds, scores, settlement — Merkle-anchored on Solana)
- Stock footage: [Pexels](https://www.pexels.com/license/) (see `public/videos/CREDITS.md`)
- Flags: [flagcdn](https://flagcdn.com)

---

*MatchPulse — call it, prove it, own it.*
