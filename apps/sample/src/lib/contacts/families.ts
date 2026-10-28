/**
 * The blockchain families the Contacts playground supports, described in one
 * table so that adding a family is a single entry.
 *
 * A family selects both the BLOCKCHAIN_FAMILY sent to the device and the
 * embedded app that serves its app-owned Contacts operations (Register / Edit
 * Identifier / Edit Scope). Rename is an OS operation and ignores the app.
 *
 * The identifier is always stored as the raw bytes the device signs over; each
 * family converts between those bytes and the address form a user types or
 * reads (hex for Ethereum, base58 for Tron and Solana).
 */
import {
  ETHEREUM_APP_NAME,
  SOLANA_APP_NAME,
  TRON_APP_NAME,
} from "@ledgerhq/device-contacts-kit";
import {
  bufferToHexaString,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import {
  decodeTronAddress,
  encodeTronAddress,
} from "@ledgerhq/device-signer-kit-tron";
import bs58 from "bs58";

export type ContactsFamily = "ethereum" | "tron" | "solana";

export type ContactsFamilyDescriptor = Readonly<{
  family: ContactsFamily;
  label: string;
  /** Embedded app serving the family's app-owned operations. */
  appName: string;
  /** Crypto icon of the family's native currency. */
  icon: Readonly<{ ledgerId: string; ticker: string }>;
  /** Whether the device payload carries a CHAIN_ID for this family. */
  hasChainId: boolean;
  addressPlaceholder: string;
  /** Human-readable address → identifier bytes, or null if malformed. */
  parse: (value: string) => Uint8Array | null;
  /** Identifier bytes → human-readable address. */
  format: (bytes: Uint8Array) => string;
  /** Shown when adding an address, when no released app supports Contacts. */
  availabilityNote?: string;
}>;

const ETHEREUM_ADDRESS_BYTES = 20;
const TRON_ADDRESS_BYTES = 21;
const TRON_ADDRESS_PREFIX = 0x41;
/** A Solana identifier is the raw ed25519 wallet public key. */
const SOLANA_ADDRESS_BYTES = 32;

function decodeBase58(value: string): Uint8Array | null {
  try {
    return bs58.decode(value);
  } catch {
    return null;
  }
}

function parseHexOfLength(value: string, length: number): Uint8Array | null {
  const bytes = hexaStringToBuffer(value.trim());
  return bytes && bytes.length === length ? bytes : null;
}

export const CONTACTS_FAMILIES: Readonly<
  Record<ContactsFamily, ContactsFamilyDescriptor>
> = {
  ethereum: {
    family: "ethereum",
    label: "Ethereum",
    appName: ETHEREUM_APP_NAME,
    icon: { ledgerId: "ethereum", ticker: "ETH" },
    hasChainId: true,
    addressPlaceholder: "0x…",
    parse: (value) => parseHexOfLength(value, ETHEREUM_ADDRESS_BYTES),
    format: (bytes) => bufferToHexaString(bytes),
  },
  tron: {
    family: "tron",
    label: "Tron",
    appName: TRON_APP_NAME,
    icon: { ledgerId: "tron", ticker: "TRX" },
    hasChainId: false,
    addressPlaceholder: "T…",
    parse: (value) => {
      const trimmed = value.trim();
      const bytes = trimmed.startsWith("T")
        ? decodeTronAddress(trimmed)
        : parseHexOfLength(trimmed, TRON_ADDRESS_BYTES);
      return bytes &&
        bytes.length === TRON_ADDRESS_BYTES &&
        bytes[0] === TRON_ADDRESS_PREFIX
        ? bytes
        : null;
    },
    format: (bytes) => encodeTronAddress(bytes),
  },
  solana: {
    family: "solana",
    label: "Solana",
    appName: SOLANA_APP_NAME,
    icon: { ledgerId: "solana", ticker: "SOL" },
    hasChainId: false,
    addressPlaceholder: "Wallet address (base58)",
    parse: (value) => {
      const trimmed = value.trim();
      // Hex is only read when explicitly prefixed: a 64-char base58 string
      // could otherwise be mistaken for hex.
      const bytes = trimmed.startsWith("0x")
        ? parseHexOfLength(trimmed, SOLANA_ADDRESS_BYTES)
        : decodeBase58(trimmed);
      return bytes && bytes.length === SOLANA_ADDRESS_BYTES ? bytes : null;
    },
    format: (bytes) => bs58.encode(bytes),
    availabilityNote:
      "Contacts needs Solana app 1.19.0 or later: on an older app the device step ends with “App update required”.",
  },
};

export const CONTACTS_FAMILY_LIST: readonly ContactsFamilyDescriptor[] =
  Object.values(CONTACTS_FAMILIES);

export function isContactsFamily(family: string): family is ContactsFamily {
  return CONTACTS_FAMILY_LIST.some((d) => d.family === family);
}

/** The descriptor of a stored family string, if the playground knows it. */
export function findContactsFamily(
  family: string,
): ContactsFamilyDescriptor | undefined {
  return isContactsFamily(family) ? CONTACTS_FAMILIES[family] : undefined;
}

export function toContactsFamilyOrThrow(family: string): ContactsFamily {
  if (!isContactsFamily(family)) {
    throw new Error(`Unsupported Contacts family: "${family}"`);
  }
  return family;
}
