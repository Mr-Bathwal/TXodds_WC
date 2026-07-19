import { NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ClaimBody {
  publicKey: string; // User's base58 public key
  amountSOL: number; // Amount of SOL to claim
  signature: string; // Signature of the claim message
  message: string; // The message they signed (e.g., "Claim MatchPulse rewards")
}

export async function POST(request: Request) {
  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { publicKey, amountSOL, signature, message } = body;
  if (!publicKey || !amountSOL || !signature || !message) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Bound the payout so a crafted request can't drain the devnet relayer.
  const MAX_CLAIM_SOL = 0.5;
  if (typeof amountSOL !== "number" || !Number.isFinite(amountSOL) || amountSOL <= 0 || amountSOL > MAX_CLAIM_SOL) {
    return NextResponse.json({ error: `Invalid amount (max ${MAX_CLAIM_SOL} SOL per claim)` }, { status: 400 });
  }

  // 1. Verify the signature
  try {
    const valid = nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(publicKey)
    );
    if (!valid) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }
  } catch (e) {
    return NextResponse.json({ error: "Invalid signature format" }, { status: 400 });
  }

  // 2. Prepare transaction
  const secret = process.env.SOLANA_RELAYER_SECRET;
  if (!secret) {
    // Simulated claim if no relayer secret is provided
    return NextResponse.json({
      success: true,
      signature: "simulated_claim_tx_signature",
      cluster: "devnet",
      simulated: true,
    });
  }

  try {
    const relayerKeypair = Keypair.fromSecretKey(bs58.decode(secret));
    const rpc = process.env.SOLANA_RPC || clusterApiUrl("devnet");
    const connection = new Connection(rpc, "confirmed");

    const toPubkey = new PublicKey(publicKey);
    const lamports = Math.floor(amountSOL * 1e9);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: relayerKeypair.publicKey,
        toPubkey,
        lamports,
      })
    );

    const txSignature = await sendAndConfirmTransaction(connection, tx, [relayerKeypair]);

    return NextResponse.json({
      success: true,
      signature: txSignature,
      cluster: "devnet",
      simulated: false,
    });
  } catch (error: any) {
    console.error("Claim payout error:", error);
    return NextResponse.json({ error: "Failed to process payout" }, { status: 500 });
  }
}
