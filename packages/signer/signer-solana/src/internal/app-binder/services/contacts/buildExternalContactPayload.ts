import { buildProvideContactPayload } from "@ledgerhq/device-contacts-kit";
import { PublicKey } from "@solana/web3.js";

import { type TokenAccountOwners } from "@api/app-binder/TokenAccountOwners";
import { type SolanaAddressBook } from "@api/model/SolanaAddressBook";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";
import { getAssociatedTokenAddressSync } from "@internal/app-binder/services/utils/splToken";

import { type TransferRecipient } from "./extractTransferRecipient";

const BLOCKCHAIN_FAMILY = "solana";
const PUBLIC_KEY_LENGTH = 32;

export type BuildExternalContactPayloadArgs = {
  readonly addressBook: SolanaAddressBook;
  readonly recipient: TransferRecipient;
};

export type BuildOwnerContactPayloadArgs = BuildExternalContactPayloadArgs & {
  /** Token account owners the clear-sign descriptors attested to the device. */
  readonly tokenAccountOwners: TokenAccountOwners;
};

/**
 * Encode the first external contact whose wallet receives the transfer, or
 * return `undefined` when none does.
 *
 * The identifier sent is always the contact's wallet public key, also for a
 * token transfer whose on-chain recipient is that wallet's token account. A
 * wallet receives a token transfer when the token account is its associated
 * token account for the transfer's mint.
 */
export function buildExternalContactPayload({
  addressBook,
  recipient,
}: BuildExternalContactPayloadArgs): Uint8Array | undefined {
  return findContactPayload(addressBook, (wallet) =>
    receives(wallet, recipient),
  );
}

/**
 * Encode the first external contact whose wallet owns the recipient token
 * account, as attested to the device by a clear-sign descriptor, or return
 * `undefined` when there is no such token account or no such contact.
 *
 * Only a token transfer can match: its token account must have an attested
 * owner, and that owner must be a contact's wallet. The identifier sent is the
 * contact's wallet public key.
 */
export function buildOwnerContactPayload({
  addressBook,
  recipient,
  tokenAccountOwners,
}: BuildOwnerContactPayloadArgs): Uint8Array | undefined {
  if (recipient.kind !== "token") return undefined;

  const attestedOwner = tokenAccountOwners[recipient.tokenAccount.toBase58()];
  const owner =
    attestedOwner === undefined
      ? undefined
      : decodeSolanaAddress(attestedOwner);
  if (owner === undefined) return undefined;

  return findContactPayload(addressBook, (wallet) => wallet.equals(owner));
}

function findContactPayload(
  addressBook: SolanaAddressBook,
  matches: (wallet: PublicKey) => boolean,
): Uint8Array | undefined {
  for (const group of addressBook.contactGroups) {
    for (const candidate of group.externalAddresses) {
      const wallet = decodeSolanaAddress(candidate.address);
      if (wallet === undefined || !matches(wallet)) continue;

      return buildProvideContactPayload({
        contactName: group.contactName,
        scope: candidate.scope,
        identifier: wallet.toBytes(),
        groupHandle: group.groupHandle,
        hmacProof: group.hmacProof,
        hmacRest: candidate.hmacRest,
        blockchainFamily: BLOCKCHAIN_FAMILY,
      });
    }
  }

  return undefined;
}

function receives(wallet: PublicKey, recipient: TransferRecipient): boolean {
  if (recipient.kind === "native") return wallet.equals(recipient.address);
  if (recipient.mint === undefined) return false;

  try {
    return getAssociatedTokenAddressSync(
      recipient.mint,
      wallet,
      true,
      recipient.tokenProgram,
    ).equals(recipient.tokenAccount);
  } catch {
    return false;
  }
}

// `new PublicKey(string)` zero-pads short inputs, so decode and check the
// length first rather than accept a string that is no public key.
function decodeSolanaAddress(address: string): PublicKey | undefined {
  try {
    const bytes = DefaultBs58Encoder.decode(address);
    return bytes.length === PUBLIC_KEY_LENGTH
      ? new PublicKey(bytes)
      : undefined;
  } catch {
    return undefined;
  }
}
