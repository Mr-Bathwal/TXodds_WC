import { NextResponse } from "next/server";
import { getTxLineClient, isLive } from "@/lib/txline";
import type { MatchStatus } from "@/lib/txline";

export const dynamic = "force-dynamic"; // always fresh — live scores

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") as MatchStatus | null;
  const client = getTxLineClient();
  const fixtures = await client.getFixtures(status ?? undefined);
  return NextResponse.json(
    { fixtures, source: client.source, live: isLive() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
