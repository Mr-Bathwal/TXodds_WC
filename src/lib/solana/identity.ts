"use client";

import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

/**
 * In-browser identity — the Polymarket-style "no seed phrase" pattern.
 *
 * A persistent ed25519 keypair is generated once and stored in localStorage.
 * The user gets a real Solana public key they sign predictions with, but never
 * has to install a wallet, manage a seed phrase, or hold SOL — our relayer pays
 * to anchor commitments on-chain. Linking a real wallet (Phantom) is an optional
 * upgrade layered on top later.
 */

const STORAGE_KEY = "matchpulse.identity.v1";
const NAME_KEY = "matchpulse.identity.name";

export interface Identity {
  publicKey: string; // base58
  keypair: Keypair;
}

let cached: Identity | null = null;

export function getIdentity(): Identity {
  if (cached) return cached;
  if (typeof window === "undefined") throw new Error("identity is client-only");

  const stored = localStorage.getItem(STORAGE_KEY);
  let keypair: Keypair;
  if (stored) {
    keypair = Keypair.fromSecretKey(bs58.decode(stored));
  } else {
    keypair = Keypair.generate();
    localStorage.setItem(STORAGE_KEY, bs58.encode(keypair.secretKey));
  }
  cached = { publicKey: keypair.publicKey.toBase58(), keypair };
  return cached;
}

/** Signs a UTF-8 message, returning a base58 detached signature. */
export function signMessage(message: string): string {
  const { keypair } = getIdentity();
  const sig = nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey);
  return bs58.encode(sig);
}

/** Verifies a base58 signature against a message and base58 public key. */
export function verifySignature(message: string, signature: string, publicKey: string): boolean {
  try {
    return nacl.sign.detached.verify(
      new TextEncoder().encode(message),
      bs58.decode(signature),
      bs58.decode(publicKey),
    );
  } catch {
    return false;
  }
}

export function getDisplayName(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(NAME_KEY);
}

export function setDisplayName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim().slice(0, 24));
}
