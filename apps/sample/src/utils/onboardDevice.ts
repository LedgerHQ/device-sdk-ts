/**
 * Host onboarding — provisions a device with a PIN and a BIP39 seed phrase
 * without going through the on-device onboarding UI. Undermines the
 * device's security model; for development/testing only.
 *
 * Port of ledgerblue's hostOnboard.py (CLA=0xE0, INS=0xD0).
 */

const CLA = 0xe0;
const INS_SETUP = 0xd0;

export type OnboardIdentity = 0 | 1 | 2;

export type OnboardDeviceParams = {
  /** Identity slot. 0 and 1 are persistent (require a PIN); 2 is temporary (must have no PIN). */
  identity: OnboardIdentity;
  /** 4-8 digit PIN. Required for identity 0/1, must be omitted for identity 2. */
  pin?: string;
  /** BIP32 path re-rooting the derivation tree. Leave empty for standard behavior. */
  prefix?: string;
  /** BIP39 passphrase (the "25th word"). */
  passphrase?: string;
  /** Space-separated BIP39 mnemonic. */
  words: string;
};

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function lengthPrefixedUtf8(value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  if (bytes.length > 0xff) {
    throw new Error(
      `Value is too long to encode (${bytes.length} > 255 bytes)`,
    );
  }
  return concat(new Uint8Array([bytes.length]), bytes);
}

// Status words documented for the "Onboard" command (section 1.39):
// https://ledgerhq.atlassian.net/wiki/spaces/FW/pages/4455596105
const STATUS_WORD_MESSAGES: Record<number, string> = {
  0x5212: "Incorrect CRC of factory slot 1",
  0x6609: "The main identity must be set before the alternate identity",
  0x660a: "The main identity has already been set",
  0x6508: "Invalid identity value",
  0x6708: "Incorrect length",
  0x660b: "The temporary identity must not have a PIN",
  0x660c: "The main and alternate identities require a PIN",
  0x660d: "No words provided and the device is not yet onboarded",
  0x6709: "Passphrase and prefix combined length exceeds the maximum",
  0x5304: "Watchdog fault",
  0x660e:
    "The device is already onboarded — onboard only works on a fresh device or in recovery mode",
  0x660f: "The device is not onboarded despite the seed and PIN being written",
  0x5324: "Incorrect words format",
  // Not in the doc above — confirmed empirically: returned when the device
  // is booted normally instead of being in recovery mode.
  0x6d07: "The device must be in recovery mode to be onboarded this way",
};

function formatSw(sw: number): string {
  const hex = `0x${sw.toString(16).padStart(4, "0")}`;
  const message = STATUS_WORD_MESSAGES[sw];
  return message ? `${hex} (${message})` : hex;
}

/** Throws a descriptive error if the response status word isn't 0x9000. */
export function checkOnboardStatusWord(statusCode: Uint8Array): void {
  const sw = (statusCode[0]! << 8) | statusCode[1]!;
  if (sw !== 0x9000) {
    throw new Error(`Onboard failed: ${formatSw(sw)}`);
  }
}

/**
 * Builds the SETUP APDU for host onboarding. Field order in the data
 * payload is fixed: PIN, derivation prefix, derivation passphrase, words —
 * each length-prefixed, matching hostOnboard.py exactly.
 */
export function buildOnboardApdu(params: OnboardDeviceParams): Uint8Array {
  if (params.identity === 2 && params.pin) {
    throw new Error("The temporary identity (2) cannot have a PIN");
  }
  if (params.identity !== 2 && !params.pin) {
    throw new Error("A PIN is required for a persistent identity (0 or 1)");
  }

  const data = concat(
    lengthPrefixedUtf8(params.pin ?? ""),
    lengthPrefixedUtf8(params.prefix ?? ""),
    lengthPrefixedUtf8(params.passphrase ?? ""),
    lengthPrefixedUtf8(params.words),
  );

  return concat(
    new Uint8Array([CLA, INS_SETUP, params.identity, 0x00, data.length]),
    data,
  );
}
