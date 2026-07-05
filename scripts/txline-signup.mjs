// One-shot: create a devnet Solana identity, subscribe to the free World Cup
// tier on-chain, activate the TxLINE API token, and probe what data is served.
// Flow based on the Apache-2.0 examples in github.com/txodds/tx-on-chain.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import nacl from "tweetnacl";
import axios from "axios";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Devnet config (from tx-on-chain README) ----
const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
const API_HOSTS = ["https://txline-dev.txodds.com", "https://oracle-dev.txodds.com"];
const SERVICE_LEVEL = 1; // World Cup + International Friendlies (60s delayed)
const WEEKS = 4;
const KEY_PATH = path.join(__dirname, ".txline-devnet-key.json");
const CRED_PATH = path.join(__dirname, ".txline-creds.json");

const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "txoracle-idl.json"), "utf8"));
idl.address = PROGRAM_ID.toBase58(); // point the mainnet IDL at the devnet program

function loadKeypair() {
  if (fs.existsSync(KEY_PATH)) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(KEY_PATH, "utf8"))));
  const kp = Keypair.generate();
  fs.writeFileSync(KEY_PATH, JSON.stringify(Array.from(kp.secretKey)));
  return kp;
}

async function ensureSol(conn, kp) {
  let bal = await conn.getBalance(kp.publicKey);
  if (bal >= 0.05 * LAMPORTS_PER_SOL) return bal;
  for (const amt of [1, 0.5]) {
    try {
      const sig = await conn.requestAirdrop(kp.publicKey, amt * LAMPORTS_PER_SOL);
      const bh = await conn.getLatestBlockhash();
      await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
      return await conn.getBalance(kp.publicKey);
    } catch (e) {
      console.log(`  airdrop ${amt} failed: ${String(e.message).slice(0, 80)}`);
    }
  }
  return await conn.getBalance(kp.publicKey);
}

async function postFirstHost(pathname, body, headers) {
  let lastErr;
  for (const host of API_HOSTS) {
    try {
      const r = await axios.post(`${host}${pathname}`, body, { headers, timeout: 20000 });
      return { host, data: r.data };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const kp = loadKeypair();
  console.log("Devnet identity:", kp.publicKey.toBase58());

  const bal = await ensureSol(conn, kp);
  console.log("SOL balance:", bal / LAMPORTS_PER_SOL);
  if (bal < 0.01 * LAMPORTS_PER_SOL) {
    console.log("\nNEED_FUNDING: fund this devnet address with ~0.2 SOL at https://faucet.solana.com then rerun:");
    console.log(kp.publicKey.toBase58());
    process.exit(2);
  }

  const wallet = new anchor.Wallet(kp);
  const provider = new anchor.AnchorProvider(conn, wallet, { commitment: "confirmed" });
  const program = new anchor.Program(idl, provider);

  console.log("Ensuring TXL token account (Token-2022)…");
  const userAta = await getOrCreateAssociatedTokenAccount(
    conn, kp, TXL_MINT, kp.publicKey, false, "confirmed", undefined, TOKEN_2022_PROGRAM_ID,
  );

  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from("pricing_matrix")], PROGRAM_ID);
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from("token_treasury_v2")], PROGRAM_ID);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(TXL_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID);

  console.log("Requesting guest JWT…");
  const guest = await postFirstHost("/auth/guest/start", undefined, undefined);
  const host = guest.host;
  const jwt = guest.data.token;
  console.log("  host:", host);

  console.log(`Subscribing on-chain (service level ${SERVICE_LEVEL}, ${WEEKS} weeks)…`);
  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL, WEEKS)
    .accounts({
      user: kp.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TXL_MINT,
      userTokenAccount: userAta.address,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("  subscribe tx:", txSig);

  const messageString = `${txSig}::${jwt}`; // empty leagues → double colon
  const walletSignature = Buffer.from(
    nacl.sign.detached(new TextEncoder().encode(messageString), kp.secretKey),
  ).toString("base64");

  console.log("Activating API token…");
  const act = await axios.post(
    `${host}/api/token/activate`,
    { txSig, walletSignature, leagues: [] },
    { headers: { Authorization: `Bearer ${jwt}` }, timeout: 20000 },
  );
  const apiToken = act.data.token || act.data;
  console.log("  API token:", String(apiToken).slice(0, 24) + "…");

  fs.writeFileSync(CRED_PATH, JSON.stringify({ host, apiToken, programId: PROGRAM_ID.toBase58(), wallet: kp.publicKey.toBase58(), subscribedAt: Date.now() }, null, 2));
  console.log("Saved credentials to", CRED_PATH);

  // ---- Probe what data we actually get ----
  const api = axios.create({ baseURL: host, timeout: 25000, headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken } });
  for (const ep of ["/api/fixtures/snapshot", "/api/odds/snapshot", "/api/scores/snapshot"]) {
    try {
      const r = await api.get(ep);
      const data = r.data;
      const n = Array.isArray(data) ? data.length : Object.keys(data || {}).length;
      console.log(`\n${ep} → ${n} items`);
      const sample = Array.isArray(data) ? data.slice(0, 3) : data;
      console.log(JSON.stringify(sample, null, 1).slice(0, 900));
    } catch (e) {
      console.log(`\n${ep} → ERROR ${e.response?.status || ""} ${JSON.stringify(e.response?.data || e.message).slice(0, 200)}`);
    }
  }
  console.log("\nDONE");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  if (e.logs) e.logs.forEach((l) => console.error(l));
  process.exit(1);
});
