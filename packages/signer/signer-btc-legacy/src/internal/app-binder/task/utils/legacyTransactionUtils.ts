import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 } from "@noble/hashes/sha256";

export const compressPublicKey = (publicKey: Uint8Array): Uint8Array => {
  const prefix = ((publicKey.at(64) ?? 0) & 1) === 0 ? 0x02 : 0x03;
  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(publicKey.subarray(1, 33), 1);
  return compressed;
};

export const hashPublicKey = (buffer: Uint8Array): Uint8Array =>
  ripemd160(sha256(buffer));
