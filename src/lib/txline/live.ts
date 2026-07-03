import type { Fixture, MatchResult, MatchStatus, TxLineClient } from "./types";

/**
 * Live TxLINE provider (server-side only — holds the JWT/API token).
 *
 * Auth flow (from TxLINE docs, https://txline-docs.txodds.com/documentation/quickstart):
 *   1. POST https://txline.txodds.com/auth/guest/start           -> guest JWT
 *   2. Subscribe on-chain to the free World Cup feed (Solana wallet + TxL)
 *   3. POST https://txline.txodds.com/api/token/activate          -> apiToken
 *      (header: Authorization: Bearer <jwt>, body: signed subscription proof)
 *   4. Call REST feeds with the apiToken.
 *
 * Until the wallet subscription is activated, we surface a clear error so the
 * app falls back to the mock provider. The response mapping below is written
 * against the documented shapes and adjusted once we see real payloads.
 */

const BASE = process.env.TXLINE_API_BASE ?? "https://txline.txodds.com";

export class LiveTxLineClient implements TxLineClient {
  readonly source = "live" as const;

  constructor(private readonly apiToken: string) {}

  private async fetchJson<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
      // Live odds/scores must never be cached.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`TxLINE ${path} -> ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  }

  async getFixtures(status?: MatchStatus): Promise<Fixture[]> {
    const raw = await this.fetchJson<{ fixtures: unknown[] }>("/api/v1/fixtures");
    const fixtures = raw.fixtures.map(mapFixture);
    return status ? fixtures.filter((f) => f.status === status) : fixtures;
  }

  async getFixture(id: string): Promise<Fixture | null> {
    const raw = await this.fetchJson<unknown>(`/api/v1/fixtures/${id}`);
    return raw ? mapFixture(raw) : null;
  }

  async getResult(id: string): Promise<MatchResult | null> {
    const f = await this.getFixture(id);
    if (!f || f.status !== "finished") return null;
    const outcome =
      f.homeScore > f.awayScore ? "home" : f.homeScore < f.awayScore ? "away" : "draw";
    return {
      fixtureId: f.id,
      homeScore: f.homeScore,
      awayScore: f.awayScore,
      outcome,
      totalGoals: f.homeScore + f.awayScore,
      finishedAt: f.kickoff,
      verification: f.verification,
    };
  }
}

/**
 * Maps a raw TxLINE fixture payload into our {@link Fixture} shape.
 * TODO(live): finalise field names against real payloads once subscribed.
 */
function mapFixture(raw: unknown): Fixture {
  // Placeholder passthrough — the real mapping is filled in when we have a
  // sample response. Keeping the surface here means only this function changes.
  return raw as Fixture;
}

/** Obtain and activate an API token. Called from a server route / build step. */
export async function activateApiToken(signedSubscriptionProof: string): Promise<string> {
  const guest = await fetch(`${BASE}/auth/guest/start`, { method: "POST" });
  if (!guest.ok) throw new Error(`guest/start -> ${guest.status}`);
  const { jwt } = (await guest.json()) as { jwt: string };

  const activated = await fetch(`${BASE}/api/token/activate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ proof: signedSubscriptionProof }),
  });
  if (!activated.ok) throw new Error(`token/activate -> ${activated.status}`);
  const { apiToken } = (await activated.json()) as { apiToken: string };
  return apiToken;
}
