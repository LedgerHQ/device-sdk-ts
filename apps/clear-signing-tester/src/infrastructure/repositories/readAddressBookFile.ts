import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { type EvmAddressBook } from "@ledgerhq/device-signer-kit-ethereum";
import { readFileSync } from "fs";

/**
 * An address book as written in a file: byte fields hex-encoded, chain ids as a
 * number or decimal string, since JSON has neither bytes nor bigint.
 */
type RawAddressBook = {
  contactGroups?: {
    contactName?: string;
    groupHandle?: string;
    hmacProof?: string;
    externalAddresses?: {
      scope?: string;
      address?: string;
      chainId?: string | number;
      hmacRest?: string;
    }[];
  }[];
};

/**
 * Read the address book the signer is built with.
 *
 * The proofs are device-issued and seed-bound: record them from a
 * `contact-file` run on the same device to test the matching path, or write
 * anything else to test that a book the device refuses costs no signature.
 */
export function readAddressBookFile(filePath: string): EvmAddressBook {
  const raw = JSON.parse(readFileSync(filePath, "utf-8")) as RawAddressBook;

  return {
    contactGroups: (raw.contactGroups ?? []).map((group, index) => ({
      contactName: required(group.contactName, index, "contactName"),
      groupHandle: bytes(group.groupHandle, index, "groupHandle"),
      hmacProof: bytes(group.hmacProof, index, "hmacProof"),
      externalAddresses: (group.externalAddresses ?? []).map((entry) => ({
        scope: required(entry.scope, index, "externalAddresses[].scope"),
        address: required(
          entry.address,
          index,
          "externalAddresses[].address",
        ) as `0x${string}`,
        chainId: BigInt(
          required(entry.chainId, index, "externalAddresses[].chainId"),
        ),
        hmacRest: bytes(entry.hmacRest, index, "externalAddresses[].hmacRest"),
      })),
    })),
    ledgerAccounts: [],
  };
}

function required<T>(value: T | undefined, index: number, field: string): T {
  if (value === undefined) {
    throw new Error(`Address book group ${index} is missing '${field}'`);
  }
  return value;
}

function bytes(value: string | undefined, index: number, field: string) {
  const buffer = hexaStringToBuffer(required(value, index, field));
  if (!buffer) {
    throw new Error(`Address book group ${index} has a malformed '${field}'`);
  }
  return buffer;
}
