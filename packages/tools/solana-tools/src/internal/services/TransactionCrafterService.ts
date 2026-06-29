import { bufferToBase64String } from "@ledgerhq/device-management-kit";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  type AddressLookupTableAccount,
  PublicKey,
  TransactionMessage,
} from "@solana/web3.js";

import { deserializeToMessage } from "./crafter/deserialize";

export type CraftOptions = {
  /**
   * base58 payer. When set, seeds auto-detect: the old payer maps to this
   * payer, and the old payer's ATAs map to this payer's ATAs.
   */
  readonly payer?: string;
  /**
   * base58 old to new pairs, applied verbatim. Overrides any auto-detect entry
   * on a key collision.
   */
  readonly replacements?: ReadonlyMap<string, string>;
  /**
   * Fully-resolved lookup tables from the resolver. Empty for legacy or no-ALT
   * messages.
   */
  readonly addressLookupTableAccounts?: readonly AddressLookupTableAccount[];
};

// Solana caps a serialized transaction at this many bytes. A crafted message is
// never broadcast, but the device rejects anything over the limit, so promoting
// too many ALT-supplied accounts to static keys is surfaced as a clear error.
const PACKET_DATA_SIZE = 1232;
const SIGNATURE_LENGTH = 64;

export class TransactionCrafterService {
  /**
   * Re-point the chosen accounts of a fetched transaction to new addresses and
   * return the crafted message as base64.
   *
   * The input is either a serialized message or a full serialized transaction
   * (signatures are dropped). The message is decompiled with the supplied
   * lookup tables, the replacement set is applied on real public keys, and the
   * message is recompiled. Replaced ALT-supplied accounts fall out of their
   * tables and are promoted into the static keys; untouched accounts keep using
   * their tables. The original recent blockhash is reused verbatim so that
   * durable-nonce values are preserved.
   *
   * Synchronous and side-effect free: it never touches the network. Resolved
   * lookup tables must be passed in via options.addressLookupTableAccounts.
   */
  public getCraftedTransaction(
    transactionBase64: string,
    options: CraftOptions,
  ): string {
    const message = deserializeToMessage(transactionBase64);
    const addressLookupTableAccounts = [
      ...(options.addressLookupTableAccounts ?? []),
    ];
    const isLegacy = message.version === "legacy";

    const txMessage = TransactionMessage.decompile(message, {
      addressLookupTableAccounts,
    });

    const oldPayer = txMessage.payerKey;
    const replacements = this.buildReplacements(txMessage, oldPayer, options);

    for (const instruction of txMessage.instructions) {
      for (const account of instruction.keys) {
        const replacement = replacements.get(account.pubkey.toBase58());
        if (replacement) {
          // Only the address is swapped. The signer and writable flags are left
          // untouched on purpose: decompile reconstructed them from the header
          // and recompile recomputes the header and account ordering.
          account.pubkey = replacement;
        }
      }
    }

    const newPayer = replacements.get(oldPayer.toBase58());
    if (newPayer) {
      txMessage.payerKey = newPayer;
    }

    const crafted = isLegacy
      ? txMessage.compileToLegacyMessage()
      : txMessage.compileToV0Message(addressLookupTableAccounts);

    const serialized = crafted.serialize();

    // The full transaction is the message plus its signature section. Check it
    // against the packet limit so an oversized craft fails here rather than on
    // the device.
    const transactionSize =
      1 +
      crafted.header.numRequiredSignatures * SIGNATURE_LENGTH +
      serialized.length;
    if (transactionSize > PACKET_DATA_SIZE) {
      throw new Error(
        `Crafted transaction is ${transactionSize} bytes, over the ${PACKET_DATA_SIZE}-byte limit. Re-pointing fewer ALT-supplied accounts keeps more of them in their lookup tables.`,
      );
    }

    return bufferToBase64String(serialized);
  }

  private buildReplacements(
    txMessage: TransactionMessage,
    oldPayer: PublicKey,
    options: CraftOptions,
  ): Map<string, PublicKey> {
    const replacements = new Map<string, PublicKey>();

    // Auto-detect mode seeds the map from the payer: the old payer and its ATAs
    // point at the new payer and its ATAs.
    if (options.payer !== undefined) {
      const newPayer = this.decodePublicKey(options.payer);
      replacements.set(oldPayer.toBase58(), newPayer);
      this.seedAtaReplacements(txMessage, oldPayer, newPayer, replacements);
    }

    // Explicit pairs are applied verbatim and override auto-detect entries on a
    // key collision. The caller supplies the new address directly, so any
    // account (including user-seeded PDAs) can be re-pointed this way.
    if (options.replacements) {
      for (const [oldKey, newKey] of options.replacements) {
        // Validate both ends so a bad pair fails here with a clear message.
        this.decodePublicKey(oldKey);
        replacements.set(oldKey, this.decodePublicKey(newKey));
      }
    }

    return replacements;
  }

  private seedAtaReplacements(
    txMessage: TransactionMessage,
    oldPayer: PublicKey,
    newPayer: PublicKey,
    replacements: Map<string, PublicKey>,
  ): void {
    const accounts = this.collectAccounts(txMessage);

    for (const account of accounts) {
      if (account.equals(oldPayer)) {
        continue;
      }
      if (replacements.has(account.toBase58())) {
        continue;
      }

      // Test every account as a candidate mint, for both token programs: an ATA
      // of the old payer for a referenced mint is re-pointed to the new payer's
      // ATA for that same mint.
      for (const mint of accounts) {
        for (const tokenProgram of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
          try {
            const oldAta = getAssociatedTokenAddressSync(
              mint,
              oldPayer,
              true,
              tokenProgram,
            );
            if (oldAta.equals(account)) {
              const newAta = getAssociatedTokenAddressSync(
                mint,
                newPayer,
                true,
                tokenProgram,
              );
              replacements.set(account.toBase58(), newAta);
            }
          } catch {
            // Not a valid ATA derivation for this mint and token program.
          }
        }
      }
    }
  }

  private collectAccounts(txMessage: TransactionMessage): PublicKey[] {
    const seen = new Set<string>();
    const accounts: PublicKey[] = [];

    const add = (publicKey: PublicKey): void => {
      const key = publicKey.toBase58();
      if (!seen.has(key)) {
        seen.add(key);
        accounts.push(publicKey);
      }
    };

    add(txMessage.payerKey);
    for (const instruction of txMessage.instructions) {
      add(instruction.programId);
      for (const account of instruction.keys) {
        add(account.pubkey);
      }
    }

    return accounts;
  }

  private decodePublicKey(value: string): PublicKey {
    try {
      return new PublicKey(value.trim());
    } catch {
      throw new Error("Failed to decode public key from base58.");
    }
  }
}
