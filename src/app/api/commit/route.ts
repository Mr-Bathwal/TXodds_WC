import { NextResponse } from "next/server";
import nacl from "tweetnacl";
import bs58 from "bs58";
import {
  hashCommitment,
  memoPayload,
  serializeCommitment,
  type Commitment,
} from "@/lib/solana/commitment";
import { anchorCommitment, explorerUrl } from "@/lib/solana/relayer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CommitBody {
  commitment: Commitment;
  signature: string; // base58, author's signature over serializeCommitment
}

export async function POST(request: Request) {
  let body: CommitBody;
  try {
    body = (await request.json()) as CommitBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { commitment, signature } = body;
  if (!commitment?.author || !signature) {
    return NextResponse.json({ error: "Missing commitment or signature" }, { status: 400 });
  }

  // Verify the author actually signed this exact pick — no forged commitments.
  const message = serializeCommitment(commitment);
  const valid = nacl.sign.detached.verify(
    new TextEncoder().encode(message),
    bs58.decode(signature),
    bs58.decode(commitment.author),
  );
  if (!valid) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  const hash = await hashCommitment(commitment);
  const payload = memoPayload(hash, commitment.author, commitment.createdAt);
  const anchor = await anchorCommitment(payload);

  return NextResponse.json({
    hash,
    signature: anchor.signature,
    explorer: explorerUrl(anchor.signature, anchor.cluster),
    cluster: anchor.cluster,
    simulated: anchor.simulated,
    publishedAt: Math.floor(Date.now() / 1000),
  });
}
