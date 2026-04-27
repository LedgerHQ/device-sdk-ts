import { MIN_FEE_DISPLAY_VERSION } from "@internal/app-binder/constants";

/**
 * Returns true when `version` (format "MAJOR.MINOR.PATCH") is greater than or
 * equal to `min`. Missing/non-numeric components are treated as 0, so
 * malformed versions conservatively compare as older than any real version.
 */
export function isAtLeastVersion(
  version: string,
  min: {
    major: number;
    minor: number;
    patch: number;
  } = MIN_FEE_DISPLAY_VERSION,
): boolean {
  const [major = 0, minor = 0, patch = 0] = version
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);

  if (major !== min.major) return major > min.major;
  if (minor !== min.minor) return minor > min.minor;
  return patch >= min.patch;
}

/**
 * Encode a µCCD fee as an 8-byte big-endian unsigned integer, matching the
 * wire format the Concordium app expects when P2=FEE_DISPLAY is set.
 *
 * Throws if the fee is negative or exceeds 2^64 - 1, since either indicates
 * a caller bug (µCCD amounts are unsigned 64-bit integers on-chain).
 */
export function encodeDisplayFee(fee: bigint): Uint8Array {
  if (fee < 0n) {
    throw new RangeError(`Fee must be non-negative, got ${fee}`);
  }
  const max = (1n << 64n) - 1n;
  if (fee > max) {
    throw new RangeError(`Fee exceeds 2^64 - 1, got ${fee}`);
  }

  const buf = new Uint8Array(8);
  let value = fee;
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(value & 0xffn);
    value >>= 8n;
  }
  return buf;
}
