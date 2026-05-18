import { FEE_DISPLAY_SIZE } from "@internal/app-binder/constants";

/**
 * Encode µCCD max-fee as big-endian uint64 for the fee-display APDU extension.
 */
export function encodeMaxFeeBigEndian(value: bigint): Uint8Array {
  if (value < 0n || value > 0xffffffffffffffffn) {
    throw new RangeError(
      `maxFee out of uint64 range: ${value.toString()} (µCCD)`,
    );
  }
  const out = new Uint8Array(FEE_DISPLAY_SIZE);
  let v = value;
  for (let i = FEE_DISPLAY_SIZE - 1; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}
