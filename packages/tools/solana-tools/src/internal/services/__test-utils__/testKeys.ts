import { PublicKey } from "@solana/web3.js";

let counter = 0;

/**
 * A unique, deterministic, on-curve public key for tests that only need an
 * address. Replaces `Keypair.generate().publicKey`, which is async in
 * @solana/web3.js v3. On-curve so it also works as a token-account owner when
 * off-curve owners are refused.
 */
export function testPublicKey(): PublicKey {
  for (;;) {
    const candidate = new Uint8Array(32).fill(0x5a);
    new DataView(candidate.buffer).setUint32(0, counter++);
    if (PublicKey.isOnCurve(candidate)) {
      return new PublicKey(candidate);
    }
  }
}
