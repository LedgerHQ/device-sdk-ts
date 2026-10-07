import { PublicKey } from "@solana/web3.js";

import { type NormalizedMessage } from "@internal/app-binder/services/TransactionInspector";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@internal/app-binder/services/utils/splToken";
import { TransactionParser } from "@internal/app-binder/services/utils/TransactionParser";

/**
 * The one account a transaction sends value to.
 *
 * A native transfer names the recipient wallet directly. A token transfer
 * names the recipient's token account instead, so the mint and token program
 * travel with it: they are what links a wallet to that token account.
 */
export type TransferRecipient =
  | { readonly kind: "native"; readonly address: PublicKey }
  | {
      readonly kind: "token";
      readonly tokenAccount: PublicKey;
      readonly mint: PublicKey;
      readonly tokenProgram: PublicKey;
    };

const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

// System Program instructions open with a little-endian u32 discriminator.
const SYSTEM_TRANSFER = 2;
const SYSTEM_TRANSFER_WITH_SEED = 11;

// SPL Token instructions open with a one-byte discriminator.
const TOKEN_TRANSFER = 3;
const TOKEN_TRANSFER_CHECKED = 12;
const TOKEN_TRANSFER_FEE_EXTENSION = 26;
const SUB_TRANSFER_CHECKED_WITH_FEE = 1;

// Marks a transfer whose recipient cannot be read from the message alone.
const UNRESOLVED = Symbol("unresolved");

type AccountReader = (localIndex: number) => PublicKey | typeof UNRESOLVED;

/**
 * Find the single recipient of a transaction's transfers.
 *
 * Returns `undefined` whenever naming one recipient would be a guess: the
 * message does not parse, it holds no transfer, its transfers go to more than
 * one account, or one of them reads an account the message alone cannot tell
 * (an unresolved address lookup table slot, or an SPL `Transfer` that carries
 * no mint). Instructions that move no value to a third party are ignored.
 */
export async function extractTransferRecipient(
  messageBytes: Uint8Array,
): Promise<TransferRecipient | undefined> {
  const parsed = await new TransactionParser(undefined, {
    preserveAltRefs: true,
  })
    .parse(messageBytes)
    .run();

  return parsed.caseOf({
    Left: () => undefined,
    Right: ({ message }) => findSingleRecipient(message),
  });
}

function findSingleRecipient(
  message: NormalizedMessage,
): TransferRecipient | undefined {
  const recipients = new Map<string, TransferRecipient>();

  for (const ix of message.compiledInstructions) {
    const keyAt = (globalIndex: number | undefined) =>
      globalIndex === undefined ||
      message.addressLookupRefs?.[globalIndex] !== undefined
        ? UNRESOLVED
        : (message.allKeys[globalIndex] ?? UNRESOLVED);

    const programId = keyAt(ix.programIdIndex);
    if (programId === UNRESOLVED) continue;

    const recipient = readTransferRecipient(programId, ix.data, (localIndex) =>
      keyAt(ix.accountKeyIndexes[localIndex]),
    );
    if (recipient === null) continue;
    if (recipient === UNRESOLVED) return undefined;

    recipients.set(recipientKey(recipient), recipient);
  }

  if (recipients.size !== 1) return undefined;
  return recipients.values().next().value;
}

/**
 * The recipient of one instruction: `null` when the instruction is not a
 * transfer, `UNRESOLVED` when it is one but its recipient cannot be read.
 */
function readTransferRecipient(
  programId: PublicKey,
  data: Uint8Array,
  account: AccountReader,
): TransferRecipient | typeof UNRESOLVED | null {
  if (programId.equals(SYSTEM_PROGRAM_ID)) {
    return readSystemTransfer(data, account);
  }
  if (
    programId.equals(TOKEN_PROGRAM_ID) ||
    programId.equals(TOKEN_2022_PROGRAM_ID)
  ) {
    return readTokenTransfer(programId, data, account);
  }
  return null;
}

function readSystemTransfer(
  data: Uint8Array,
  account: AccountReader,
): TransferRecipient | typeof UNRESOLVED | null {
  if (data.length < 4) return null;
  const discriminator = new DataView(
    data.buffer,
    data.byteOffset,
    data.byteLength,
  ).getUint32(0, true);

  switch (discriminator) {
    // Transfer: [from, to]
    case SYSTEM_TRANSFER:
      return native(account(1));
    // TransferWithSeed: [from, base, to]
    case SYSTEM_TRANSFER_WITH_SEED:
      return native(account(2));
    default:
      return null;
  }
}

function readTokenTransfer(
  tokenProgram: PublicKey,
  data: Uint8Array,
  account: AccountReader,
): TransferRecipient | typeof UNRESOLVED | null {
  switch (data[0]) {
    // Transfer: [source, destination, owner]. No mint, so the destination
    // cannot be tied back to a wallet.
    case TOKEN_TRANSFER:
      return UNRESOLVED;
    // TransferChecked: [source, mint, destination, owner]
    case TOKEN_TRANSFER_CHECKED:
      return token(tokenProgram, account(2), account(1));
    // Token-2022 TransferCheckedWithFee: same accounts as TransferChecked
    case TOKEN_TRANSFER_FEE_EXTENSION:
      return data[1] === SUB_TRANSFER_CHECKED_WITH_FEE
        ? token(tokenProgram, account(2), account(1))
        : null;
    default:
      return null;
  }
}

function native(
  address: PublicKey | typeof UNRESOLVED,
): TransferRecipient | typeof UNRESOLVED {
  return address === UNRESOLVED ? UNRESOLVED : { kind: "native", address };
}

function token(
  tokenProgram: PublicKey,
  tokenAccount: PublicKey | typeof UNRESOLVED,
  mint: PublicKey | typeof UNRESOLVED,
): TransferRecipient | typeof UNRESOLVED {
  if (tokenAccount === UNRESOLVED || mint === UNRESOLVED) return UNRESOLVED;
  return { kind: "token", tokenAccount, mint, tokenProgram };
}

function recipientKey(recipient: TransferRecipient): string {
  return recipient.kind === "native"
    ? `native:${recipient.address.toBase58()}`
    : `token:${recipient.tokenAccount.toBase58()}`;
}
