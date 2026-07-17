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
