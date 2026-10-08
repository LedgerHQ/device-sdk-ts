import { buildProvideContactPayload } from "@ledgerhq/device-contacts-kit";
import { PublicKey } from "@solana/web3.js";

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

/**
 * Encode the first external contact whose wallet receives the transfer, or
 * return `undefined` when none does.
 *
 * The identifier sent is always the contact's wallet public key, also for a
 * token transfer whose on-chain recipient is that wallet's token account.
 */
export function buildExternalContactPayload({
  addressBook,
  recipient,
}: BuildExternalContactPayloadArgs): Uint8Array | undefined {
  for (const group of addressBook.contactGroups) {
    for (const candidate of group.externalAddresses) {
      const wallet = decodeSolanaAddress(candidate.address);
      if (wallet === undefined || !receives(wallet, recipient)) continue;

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
