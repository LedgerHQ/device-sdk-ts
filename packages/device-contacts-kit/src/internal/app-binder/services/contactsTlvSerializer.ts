// TLV encoding for the Contacts feature.
// Tags are always encoded as their raw one-byte value per the Address Book
// specification; lengths >= 0x80 use DER long form.
// Wire format per the BOLOS SDK address-book spec
// (ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md §4.2).
import { ByteArrayBuilder } from "@ledgerhq/device-management-kit";

export const CONTACTS_TLV_TAG = {
  STRUCT_TYPE: 0x01,
  STRUCT_VERSION: 0x02,
  // Ledger-Account operations only; external-address ops carry no path.
  // TODO(Ledger Account ticket): spec tag registry lists 0x69 but the per-op
  // payload tables list 0x21 — confirm before the Ledger-Account op ships.
  DERIVATION_PATH: 0x69,
  CHAIN_ID: 0x23,
  HMAC_PROOF: 0x29,
  BLOCKCHAIN_FAMILY: 0x51,
  CONTACT_NAME: 0xf0,
  SCOPE: 0xf1,
  ACCOUNT_IDENTIFIER: 0xf2,
  PREVIOUS_CONTACT_NAME: 0xf3,
  PREVIOUS_IDENTIFIER: 0xf4,
  PREVIOUS_SCOPE: 0xf5,
  GROUP_HANDLE: 0xf6,
  HMAC_REST: 0xf7,
} as const;

export const STRUCT_TYPE_REGISTER_IDENTITY = 0x2d;
export const STRUCT_TYPE_EDIT_CONTACT_NAME = 0x2e;
export const STRUCT_TYPE_REGISTER_LEDGER_ACCOUNT = 0x2f;
export const STRUCT_TYPE_EDIT_LEDGER_ACCOUNT = 0x30;
export const STRUCT_TYPE_EDIT_IDENTIFIER = 0x31;
export const STRUCT_TYPE_EDIT_SCOPE = 0x32;
export const STRUCT_TYPE_PROVIDE_CONTACT = 0x33;
export const STRUCT_TYPE_PROVIDE_LEDGER_ACCOUNT_CONTACT = 0x34;
export const STRUCT_VERSION_VALUE = 0x01;

function writeTag(builder: ByteArrayBuilder, tag: number): void {
  // Address Book tags are always a single raw byte — no BER multi-byte form.
  builder.add8BitUIntToData(tag);
}

function writeDerLength(builder: ByteArrayBuilder, length: number): void {
  if (length < 0x80) {
    builder.add8BitUIntToData(length);
  } else if (length <= 0xff) {
    builder.add8BitUIntToData(0x81);
    builder.add8BitUIntToData(length);
  } else if (length <= 0xffff) {
    builder.add8BitUIntToData(0x82);
    builder.add16BitUIntToData(length);
  } else {
    throw new Error(`TLV length ${length} exceeds supported range`);
  }
}

function chainIdToMinimalBytes(chainId: number | bigint): Uint8Array {
  const big = typeof chainId === "bigint" ? chainId : BigInt(chainId);
  if (big <= 0n) {
    throw new Error(`chainId must be positive, got ${chainId}`);
  }
  if (big > 0xffffffffffffffffn) {
    throw new Error(`chainId ${chainId} exceeds uint64 range`);
  }
  const bytes: number[] = [];
  let n = big;
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  return Uint8Array.from(bytes);
}

export function encodeTlvUInt8(
  builder: ByteArrayBuilder,
  tag: number,
  value: number,
): void {
  writeTag(builder, tag);
  builder.add8BitUIntToData(1);
  builder.add8BitUIntToData(value);
}

export function encodeTlvAscii(
  builder: ByteArrayBuilder,
  tag: number,
  value: string,
): void {
  writeTag(builder, tag);
  const bytes = new TextEncoder().encode(value);
  writeDerLength(builder, bytes.length);
  builder.addBufferToData(bytes);
}

export function encodeTlvBuffer(
  builder: ByteArrayBuilder,
  tag: number,
  value: Uint8Array,
): void {
  writeTag(builder, tag);
  writeDerLength(builder, value.length);
  builder.addBufferToData(value);
}

export function encodeTlvChainId(
  builder: ByteArrayBuilder,
  tag: number,
  chainId: number | bigint,
): void {
  encodeTlvBuffer(builder, tag, chainIdToMinimalBytes(chainId));
}

/** Pack BIP32 segments as `count(1) || segment(4 BE)*count`. */
export function packDerivationPath(segments: number[]): Uint8Array {
  const builder = new ByteArrayBuilder();
  builder.add8BitUIntToData(segments.length);
  segments.forEach((segment) => builder.add32BitUIntToData(segment));
  return builder.build();
}
