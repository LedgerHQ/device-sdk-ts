/**
 * Pre-APDU input validators — TS port of
 * `~/dev/ledger-contacts-playground/src/ledger_contacts/validation.py`.
 *
 * Constants mirror the Ledger secure SDK `#define` values *including*
 * the trailing NUL terminator (so a 32-printable-char name lives in a
 * 33-byte buffer). Validators subtract 1 internally so the constants
 * remain pure equality checks against the upstream `#define`s.
 *
 * If the constants drift from the SDK headers, the playground's
 * `tests/test_upstream_pins.py` will fail first — keep these in sync
 * with that suite. The byte-level `0x20..0x7E` printable check
 * exactly matches firmware `is_printable_string` behaviour: multi-byte
 * UTF-8 sequences (`ô` = `0xC3 0xB4`) are rejected because both bytes
 * are out of range, not because of codepoint logic.
 */

// ---- SDK-mirrored constants -------------------------------------------------
// Source of truth: ~/dev/ledger-secure-sdk/app_features/address_book/include/

export const CONTACT_NAME_BUFFER_LENGTH = 33; // identity.h:49 (incl. NUL)
export const SCOPE_BUFFER_LENGTH = 33; // identity.h:50 (incl. NUL)
export const GROUP_HANDLE_SIZE = 64; // identity.h:47
export const HMAC_PROOF_LENGTH = 32; // CX_SHA256_SIZE
export const ACCOUNT_NAME_BUFFER_LENGTH = 33; // ledger_account.h:28
export const MAX_BIP32_DEPTH = 10; // bip32.h:15 (MAX_BIP32_PATH)
export const ETH_ADDRESS_BYTES = 20; // protocol convention, no header

// ---- error type -------------------------------------------------------------

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// ---- printable-string validation -------------------------------------------

const PRINTABLE_MIN = 0x20;
const PRINTABLE_MAX = 0x7e;

const utf8Encoder = new TextEncoder();

/**
 * Mirror of firmware `is_printable_string` + length cap.
 *
 * `bufferLength` is the firmware's fixed buffer size *including* the
 * trailing NUL terminator, so the maximum payload byte length is
 * `bufferLength - 1`.
 */
export function validatePrintableLabel(
  value: string,
  options: { field: string; bufferLength: number },
): void {
  const { field, bufferLength } = options;
  if (!value) {
    throw new ValidationError(
      `${field} must not be empty (firmware rejects empty strings).`,
    );
  }
  const encoded = utf8Encoder.encode(value);
  const maxBytes = bufferLength - 1;
  if (encoded.length > maxBytes) {
    throw new ValidationError(
      `${field} ${JSON.stringify(value)} is too long: ${encoded.length} bytes encoded ` +
        `(max ${maxBytes}). The device buffer is ${bufferLength} bytes including ` +
        `the trailing NUL.`,
    );
  }
  const badPositions: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    const byte = encoded[i]!;
    if (byte < PRINTABLE_MIN || byte > PRINTABLE_MAX) {
      badPositions.push(i);
    }
  }
  if (badPositions.length > 0) {
    const offendingBytes = Array.from(
      new Set(badPositions.map((i) => encoded[i]!)),
    ).sort((a, b) => a - b);
    const offendingHex = offendingBytes
      .map((b) => `0x${b.toString(16).padStart(2, "0")}`)
      .join(", ");
    throw new ValidationError(
      `${field} ${JSON.stringify(value)} contains ${badPositions.length} non-ASCII ` +
        `byte(s) at position(s) [${badPositions.join(", ")}]: ${offendingHex}. ` +
        `The device buffer is byte-level isprint() — only 0x20–0x7E are accepted, ` +
        `no UTF-8 / accents / emoji.`,
    );
  }
}

// ---- BIP32 path validation -------------------------------------------------

/**
 * Sanity-check a BIP32 path before serialization. Firmware enforces
 * depth ≤ MAX_BIP32_DEPTH and rejects malformed segments.
 *
 * Accepts `m/44'/60'/0'/0/0` style; segments may end in `'` (hardened).
 */
export function validateDerivationPath(path: string): void {
  if (!path) {
    throw new ValidationError(
      `derivationPath must not be empty (e.g. "m/44'/60'/0'/0/0").`,
    );
  }
  const parts = path.split("/");
  const segments =
    parts[0] === "m" || parts[0] === "M" ? parts.slice(1) : parts;
  if (segments.length === 0) {
    throw new ValidationError(
      `derivationPath ${JSON.stringify(path)} has no segments past 'm'.`,
    );
  }
  if (segments.length > MAX_BIP32_DEPTH) {
    throw new ValidationError(
      `derivationPath ${JSON.stringify(path)} has ${segments.length} segments ` +
        `(max ${MAX_BIP32_DEPTH}). Firmware rejects deeper paths.`,
    );
  }
  for (const segment of segments) {
    const token = segment.endsWith("'") ? segment.slice(0, -1) : segment;
    if (!token || !/^\d+$/.test(token)) {
      throw new ValidationError(
        `derivationPath ${JSON.stringify(path)} segment ${JSON.stringify(segment)} ` +
          `is not numeric. Use plain integers, optionally suffixed with ' for hardened.`,
      );
    }
    const n = Number(token);
    if (!Number.isSafeInteger(n) || n >= 0x80000000) {
      throw new ValidationError(
        `derivationPath ${JSON.stringify(path)} segment ${JSON.stringify(segment)} ` +
          `≥ 2^31. Use the ' suffix for hardening rather than overflowing.`,
      );
    }
  }
}

// ---- address validation ----------------------------------------------------

/**
 * 20-byte Ethereum address by default; configurable for future chains.
 * Accepts `0x`-prefixed and unprefixed hex.
 */
export function validateAddressHex(
  value: string,
  options: { expectedBytes?: number } = {},
): void {
  const { expectedBytes = ETH_ADDRESS_BYTES } = options;
  if (!value) {
    throw new ValidationError("address must not be empty.");
  }
  let raw = value;
  if (raw.startsWith("0x") || raw.startsWith("0X")) {
    raw = raw.slice(2);
  }
  if (!raw) {
    throw new ValidationError(
      `address ${JSON.stringify(value)} has no hex digits after the 0x prefix.`,
    );
  }
  if (raw.length % 2 !== 0) {
    throw new ValidationError(
      `address ${JSON.stringify(value)} has an odd number of hex digits (${raw.length}).`,
    );
  }
  const actualBytes = raw.length / 2;
  if (actualBytes !== expectedBytes) {
    throw new ValidationError(
      `address ${JSON.stringify(value)} is ${actualBytes} bytes, ` +
        `expected ${expectedBytes} (Ethereum).`,
    );
  }
  if (!/^[0-9a-fA-F]+$/.test(raw)) {
    throw new ValidationError(
      `address ${JSON.stringify(value)} is not valid hex.`,
    );
  }
}

// ---- chain id validation ---------------------------------------------------

/**
 * Firmware encodes chain_id as uint64. JS `number` is fine up to 2^53;
 * accept `bigint` for the high range so callers don't silently truncate.
 */
export function validateChainId(value: number | bigint): void {
  const isNumber = typeof value === "number";
  const isBigInt = typeof value === "bigint";
  if (!isNumber && !isBigInt) {
    throw new ValidationError(
      `chainId must be number or bigint, got ${typeof value}.`,
    );
  }
  if (isNumber && !Number.isInteger(value)) {
    throw new ValidationError(`chainId must be an integer, got ${value}.`);
  }
  const v = typeof value === "bigint" ? value : BigInt(value);
  if (v <= 0n) {
    throw new ValidationError(`chainId must be positive, got ${value}.`);
  }
  const UINT64_MAX = (1n << 64n) - 1n;
  if (v > UINT64_MAX) {
    throw new ValidationError(
      `chainId ${value} exceeds uint64 range (max ${UINT64_MAX}).`,
    );
  }
}
