# MatchPulse — 5-Minute Demo Video Script

> **How to use this:** Read the **SAY** lines aloud while doing the **SHOW** actions.
> Total spoken length ≈ 4 min 40 s at a normal pace — leaves 20 s of breathing room.
> The five judging criteria are named **out loud, explicitly** — judges score against
> a rubric; make it effortless for them to tick every box.

---

## ⏱ Production notes (read before recording)

- **Best take:** record while **Spain vs Argentina is LIVE (kickoff 19:00 UTC today)**.
  A score that moves on camera is the single most convincing thing you can show.
- **Safety take:** record one full pass NOW using **France vs England (finished, real
  data: 0–3, real lineups, real events)** + placing a prediction on the scheduled
  Spain–Argentina match. If the live take works, use it; otherwise you have this.
- Keep the browser at 100% zoom, dark theme, close other tabs, hide bookmarks bar.
- Have the **Telegram chat with the Pundit bot open in a phone/second window** before
  you start — you'll cut to it once.
- Have **Solana Explorer** ready to open from the in-app links (don't type URLs live).
- If a section runs long, cut from Section 6 (architecture) — never from Section 4
  (on-chain verify) — that's the originality core.

---

## 0:00 – 0:25 · Cold open — the problem

**SHOW:** Landing page (`/`), slow scroll.

**SAY:**
> "Every World Cup, a billion fans stare at a score on a screen and simply…
> trust it. Trust the feed, trust the bookmaker, trust the app. **MatchPulse**
> flips that. It's a live World Cup companion where the score, the odds, and even
> *your own predictions* can cryptographically prove themselves — powered by
> **TxODDS TxLINE data** and anchored on **Solana**."

---

## 0:25 – 1:05 · The live dashboard — *Fan Accessibility & UX*

**SHOW:** `/matches` — the fixtures list. Hover a row; point at the odds ticking.

**SAY:**
> "This is the home screen a normal, non-crypto fan lands on. No wallet, no
> sign-up wall, no jargon — just today's matches, live scores and real
> de-margined odds streaming from TxLINE. That's our first judging criterion,
> **fan accessibility**: everything you'll see works for a mainstream fan first,
> and the blockchain stays invisible until it's useful.
> Every card here is real fixture data — fixtures, odds and scores come from
> four TxLINE endpoints, polled and cached server-side."

---

## 1:05 – 2:05 · Match centre — *Real-Time Responsiveness*

**SHOW:** Open the match (live Spain–Argentina if recording during the match,
otherwise France vs England). Let the page breathe: scoreboard → live timeline →
momentum chart → stats → scroll to the 3D pitch, tilt it with the cursor, hover a
player to pop the headshot.

**SAY:**
> "This is the match centre, and this is **real-time responsiveness** in action.
> The scoreboard re-polls TxLINE every few seconds — goals, the match clock,
> corners and cards land here moments after they happen on the pitch.
> The **momentum chart** isn't an animation — it's the actual TxLINE odds
> time-series, re-normalised into win probability, so you watch the *market's
> heartbeat* react to the game.
> The timeline reconstructs the play-by-play — goals, cards, substitutions, VAR.
> And this **3D pitch** shows the confirmed line-ups in their real formation grid —
> hover a player for their photo. Where a stat can't be sourced live, the UI
> **says so honestly** — see the source label — nothing here pretends to be
> something it isn't."

*(If live: pause 3 seconds on the scoreboard when the clock ticks.)*

---

## 2:05 – 2:45 · The trust layer — *Originality & Value Creation*

**SHOW:** Click the **"Verified on-chain"** badge (top right). Let the panel open:
Merkle root, proof depth, published time. Click **"View on Solana Explorer"** —
show the transaction, then come back.

**SAY:**
> "Here's what makes MatchPulse genuinely new — our **originality** play.
> TxODDS publishes a Merkle root of every data batch to Solana. MatchPulse is,
> as far as we know, the first fan product that surfaces it: one tap and this
> match's data shows its Merkle root, its proof depth, and the on-chain
> transaction on Solana Explorer. The score you just watched isn't 'trust me' —
> it's *tamper-evident*. We're not repackaging a sports feed; we're making the
> **trust layer visible** to fans for the first time."

---

## 2:45 – 3:40 · Provable predictions — *Completeness & Execution* (part 1)

**SHOW:** Scroll to the Predict panel. Connect wallet (WalletMultiButton).
Pick a side, set a stake, hit predict → approve the signature in the wallet →
show the success state → click the commitment's explorer link.

**SAY:**
> "Now the fan game — and the Solana sign-up flow. I connect my wallet, pick
> Argentina, stake from my bankroll, and **sign the prediction**. Here's the
> clever bit: the app hashes my exact pick — match, market, timestamp, my key —
> and a **gas-less relayer anchors that hash to Solana's Memo program**. I pay
> nothing, wait for nothing. But from this second, my pick is *provably locked
> before kickoff* — nobody, including us, can quietly edit it after the goal
> goes in. Prediction games have always had a trust problem. This closes it."

---

## 3:40 – 4:15 · Settlement, leaderboard, SOL claim & the Pundit

**SHOW:** `/leaderboard` — podium, confetti on hover. Click **Sign & Claim** →
wallet signature → success. Then cut to the phone: the **Telegram Pundit**
message for a goal.

**SAY:**
> "When TxLINE finalises a match, bets settle at the odds captured at commit
> time, the leaderboard updates, and winners **sign and claim real devnet SOL** —
> the relayer pays it out instantly.
> And fans who aren't watching the app still don't miss anything: our **Pundit
> bot** fires TxLINE match events straight into Telegram with instant, zero-cost
> commentary the moment a goal or red card lands."

---

## 4:15 – 4:40 · Under the hood + business — *Commercial & Monetization Path*

**SHOW:** Match page again, slow scroll; or the README architecture diagram.

**SAY:**
> "Quickly, under the hood: five TxLINE endpoints — guest auth, fixtures, odds,
> scores and the on-chain validation feed — reconstructed server-side with a
> two-and-a-half-second live cache, enriched with player photos and deep stats,
> every number labelled with its source.
> **Commercially**, this is a free-to-play engagement layer that converts:
> white-label it to sportsbooks and broadcasters who already buy TxODDS data,
> take affiliate flow from the odds surface, and sell the verified-data badge as
> a premium trust product. The rails from fan → wallet → on-chain are already
> live."

---

## 4:40 – 5:00 · Close

**SHOW:** Back to the scoreboard. Hold it.

**SAY:**
> "MatchPulse is **complete and executing end-to-end today**: real TxLINE data
> in, live match centre, provable predictions, on-chain settlement, SOL payouts,
> and a pundit in your pocket. The World Cup runs on trust.
> We put the proof one tap away. Thanks for watching."

---

## Criteria checklist (verify before uploading)

| Judging criterion | Where it's said & shown | ✔ |
|---|---|---|
| Fan Accessibility & UX | §2 — no-wallet browsing, clean UI | ☐ |
| Real-Time Responsiveness | §3 — live scoreboard, momentum chart | ☐ |
| Originality & Value Creation | §4 — on-chain verify badge | ☐ |
| Commercial & Monetization Path | §6 — white-label / affiliate / trust badge | ☐ |
| Completeness & Execution | §5 + §7 — full loop incl. SOL claim | ☐ |
| TxLINE as live input (requirement) | §2, §3, §6 — named 4 times | ☐ |
| Sign up through Solana (requirement) | §5 — wallet + signed commitment | ☐ |
