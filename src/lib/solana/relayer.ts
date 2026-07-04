import "server-only";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { fnv1a, seededRandom } from "@/lib/utils";

/**
 * Relayer that anchors prediction commitments on Solana devnet via the Memo
 * program. The user never pays gas — this is the "relayer pays" pattern that
 * keeps the UX friction-free (Polymarket-style).
 *
 * If `SOLANA_RELAYER_SECRET` is not set, we return a deterministic *simulated*
 * anchor so the whole flow works in development and demos never break. Once a
 * funded devnet keypair is configured, commitments become real on-chain memos
 * with explorer-verifiable signatures — same code path, real proofs.
 */

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const CLUSTER = (process.env.SOLANA_CLUSTER ?? "devnet") as "devnet" | "testnet" | "mainnet-beta";
const RPC = process.env.SOLANA_RPC ?? "https://api.devnet.solana.com";

export interface AnchorResult {
  signature: string;
  cluster: typeof CLUSTER;
  simulated: boolean;
  slot?: number;
}

function relayerKeypair(): Keypair | null {
  const secret = process.env.SOLANA_RELAYER_SECRET;
  if (!secret) return null;
  return Keypair.fromSecretKey(bs58.decode(secret));
}

/** Deterministic fake signature so simulated anchors look/behave real in the UI. */
function simulatedSignature(payload: string): string {
  const seed = fnv1a(payload);
  const b58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let sig = "";
  for (let i = 0; i < 88; i++) sig += b58[Math.floor(seededRandom(seed + i * 7) * b58.length)];
  return sig;
}

export async function anchorCommitment(payload: string): Promise<AnchorResult> {
  const relayer = relayerKeypair();
  if (!relayer) {
    return { signature: simulatedSignature(payload), cluster: CLUSTER, simulated: true };
  }

  try {
    const connection = new Connection(RPC, "confirmed");
    const ix = new TransactionInstruction({
      keys: [{ pubkey: relayer.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(payload, "utf8"),
    });
    const tx = new Transaction().add(ix);
    const signature = await connection.sendTransaction(tx, [relayer]);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction({ signature, ...latest }, "confirmed");
    return { signature, cluster: CLUSTER, simulated: false };
  } catch (err) {
    // Never let an unfunded relayer or RPC hiccup break the commit flow —
    // degrade to a simulated anchor so the game keeps working.
    console.error("anchorCommitment: falling back to simulated anchor:", err);
    return { signature: simulatedSignature(payload), cluster: CLUSTER, simulated: true };
  }
}

export function explorerUrl(signature: string, cluster = CLUSTER): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}
