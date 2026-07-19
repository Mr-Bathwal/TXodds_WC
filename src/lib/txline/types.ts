/**
 * TxLINE data model.
 *
 * These types mirror the shape of the TxODDS TxLINE feed (fixtures, live scores,
 * odds and settlement) so the mock provider and the live provider are
 * interchangeable behind {@link TxLineClient}. When live credentials are wired
 * in, only `live.ts` changes — the whole UI keeps working.
 */

export type MatchStatus =
  | "scheduled" // not started
  | "live" // in play
  | "halftime"
  | "finished"
  | "postponed";

export interface Team {
  id: string;
  name: string;
  /** 3-letter code, e.g. "ARG". */
  code: string;
  /** Emoji flag (fallback). */
  flag: string;
  /** flagcdn ISO code (e.g. "ar", "gb-eng") for crisp SVG flags. */
  iso: string;
}

/** 1X2 (home / draw / away) decimal odds. */
export interface Odds {
  home: number;
  draw: number;
  away: number;
  /** When this odds snapshot was produced (ISO). */
  updatedAt: string;
}

export interface MatchEvent {
  minute: number;
  type: "goal" | "yellow" | "red" | "kickoff" | "halftime" | "fulltime";
  team?: "home" | "away";
  player?: string;
}

/** A single event in the live play-by-play feed. */
export type FeedKind =
  | "goal"
  | "shot"
  | "corner"
  | "yellow"
  | "red"
  | "sub"
  | "freekick"
  | "penalty"
  | "var"
  | "injury"
  | "kickoff"
  | "halftime"
  | "fulltime";

export interface FeedEvent {
  minute: number;
  kind: FeedKind;
  team?: "home" | "away";
  detail?: string; // e.g. shot outcome, free-kick type
}

export interface LineupPlayer {
  number: number; // shirt number
  positionId: number;
  starter: boolean;
  name?: string;
  photo?: string;
  pos?: string; // e.g. "G", "D", "M", "F"
  gridX?: number; // X coordinate on the pitch (derived from API-Football grid)
  gridY?: number; // Y coordinate on the pitch (derived from API-Football grid)
}

/** Everything decoded from the TxLINE live event stream + validation. */
export interface LiveDetail {
  events: FeedEvent[];
  possession: { home: number; away: number }; // %
  danger: { home: number; away: number }; // high-danger possession share %
  shots: { home: number; away: number; onTargetHome: number; onTargetAway: number };
  freeKicks: { home: number; away: number };
  subs: { minute: number; team: "home" | "away"; inId: number; outId: number }[];
  redCards: { home: number; away: number };
  lineup?: { home: LineupPlayer[]; away: LineupPlayer[] };
  meta: { weather?: string; pitch?: string; venue?: string };
  /** Depth of the Merkle main-tree proof path (on-chain verifiability). */
  proofDepth?: number;
  /**
   * Where this detail came from, so the UI can label it honestly:
   * `api-football` = real third-party match data; `txline` = decoded from the
   * TxLINE live stream; `synth` = deterministically estimated (out-of-window
   * fallback only, never when real data is available).
   */
  source?: "api-football" | "txline" | "synth";
}

export interface Fixture {
  id: string;
  stage: string; // e.g. "Round of 32", "Quarter-final"
  venue: string;
  /** Scheduled kickoff (ISO). */
  kickoff: string;
  status: MatchStatus;
  /** Elapsed minutes when live/halftime/finished. */
  minute: number | null;
  home: Team;
  away: Team;
  homeScore: number;
  awayScore: number;
  odds: Odds;
  events: MatchEvent[];
  /**
   * Real win-probability history from the TxLINE odds time-series (live data
   * only). Each point is normalised implied probabilities at a moment in time,
   * so the momentum chart can show how the market actually moved.
   */
  oddsHistory?: { t: number; home: number; draw: number; away: number }[];
  /**
   * Real per-side secondary stats from the TxLINE score feed (live data only):
   * cumulative corners and yellow cards, ordered [home, away].
   */
  liveStats?: { corners: [number, number]; yellowCards: [number, number] };
  /** Rich real-time detail decoded from the TxLINE event stream (live only). */
  live?: LiveDetail;
  /**
   * On-chain verification anchor. Present once TxLINE has published this
   * fixture's data Merkle root to Solana. Lets us render a "verify on Solana"
   * proof for scores/results — the trust layer made visible.
   */
  verification?: {
    /** Solana tx signature carrying the Merkle root. */
    signature: string;
    /** Hex Merkle root of the data batch. */
    merkleRoot: string;
    /** Unix seconds of on-chain publication. */
    publishedAt: number;
    cluster: "mainnet-beta" | "devnet" | "testnet";
    /** Explicit explorer link (program account for live data); overrides the tx link. */
    explorerUrl?: string;
    /** Depth of the Merkle proof path (number of hashes to the on-chain root). */
    proofDepth?: number;
  };
}

/** Result used to settle predictions once a match is final. */
export interface MatchResult {
  fixtureId: string;
  homeScore: number;
  awayScore: number;
  outcome: "home" | "draw" | "away";
  totalGoals: number;
  finishedAt: string;
  verification?: Fixture["verification"];
}

export interface TxLineClient {
  /** All fixtures, optionally filtered by status. */
  getFixtures(status?: MatchStatus): Promise<Fixture[]>;
  getFixture(id: string): Promise<Fixture | null>;
  /** Final result for a finished fixture, or null if not yet final. */
  getResult(id: string): Promise<MatchResult | null>;
  /** Human label for where the data is coming from (shown in UI). */
  readonly source: "mock" | "live";
}
