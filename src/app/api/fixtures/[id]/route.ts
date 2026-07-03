import { NextResponse } from "next/server";
import { getTxLineClient } from "@/lib/txline";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const client = getTxLineClient();
  const fixture = await client.getFixture(id);
  if (!fixture) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }
  const result = await client.getResult(id);
  return NextResponse.json(
    { fixture, result, source: client.source },
    { headers: { "Cache-Control": "no-store" } },
  );
}
