import { bufferToBase64String } from "@ledgerhq/device-management-kit";
import { address } from "@solana/addresses";
import { getCompiledTransactionMessageEncoder } from "@solana/transaction-messages";
import { PublicKey } from "@solana/web3.js";

import {
  compileTransactionMessage,
  type DecompiledV1Message,
  deserializeV1ToMessage,
  isV1FullTransaction,
} from "./crafter/deserializeV1";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "./utils/splToken";

export type V1CraftOptions = {
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
};

// SIMD-0385 raises the transaction size cap from 1232 (legacy/v0) to this.
const V1_PACKET_DATA_SIZE = 4096;
const SIGNATURE_LENGTH = 64;
const compiledTransactionMessageEncoder =
  getCompiledTransactionMessageEncoder();

/**
 * Crafts a v1 (SIMD-0385) transaction: the v1 counterpart of
 * `TransactionCrafterService`, built on `@solana/transaction-messages`
 * instead of `@solana/web3.js` since web3.js has no v1 support at any level.
 *
 * v1 has no address lookup tables at all, so unlike the legacy/v0 crafter
 * there is no ALT-resolution/promotion concern here.
 */
export class V1TransactionCrafterService {
  public getCraftedTransaction(
    transactionBase64: string,
    options: V1CraftOptions,
  ): string {
    const message = deserializeV1ToMessage(transactionBase64);

    const oldPayer = message.feePayer.address;
    const replacements = this.buildReplacements(message, oldPayer, options);

    const mutatedInstructions = message.instructions.map((instruction) => ({
      ...instruction,
      accounts: instruction.accounts?.map((account) => {
        const replacement = replacements.get(account.address);
        return replacement
          ? { ...account, address: address(replacement) }
          : account;
      }),
    }));

    const newPayer = replacements.get(oldPayer);
    const craftedMessage = {
      ...message,
      feePayer: { address: address(newPayer ?? oldPayer) },
      instructions: mutatedInstructions,
    } as DecompiledV1Message;

    const compiled = compileTransactionMessage(craftedMessage);
    const encoded = compiledTransactionMessageEncoder.encode(compiled);

    // v1 has no leading shortvec signature-count field (unlike legacy/v0):
    // numRequiredSignatures lives at byte 1 of the message itself (the
    // LegacyHeader, unchanged from legacy/v0), and signatures would be
    // appended after the message with no extra prefix — so the full
    // transaction size is just the message plus that many 64-byte slots.
    const numRequiredSignatures = encoded[1]!;
    const transactionSize =
      encoded.length + numRequiredSignatures * SIGNATURE_LENGTH;
    if (transactionSize > V1_PACKET_DATA_SIZE) {
      throw new Error(
        `Crafted transaction is ${transactionSize} bytes, over the ${V1_PACKET_DATA_SIZE}-byte limit. Re-pointing fewer accounts keeps the message smaller.`,
      );
    }

    // Mirror the input shape: a full transaction in gets re-wrapped with
    // placeholder (all-zero) signatures on the way out — re-pointing accounts
    // invalidates any original signature regardless. v1 has no leading
    // shortvec signature-count field, so the placeholder slots are appended
    // straight after the message with no extra framing.
    const messageBytes = new Uint8Array(encoded);
    const output = isV1FullTransaction(transactionBase64)
      ? this.appendEmptySignatures(messageBytes, numRequiredSignatures)
      : messageBytes;

    return bufferToBase64String(output);
  }

  private appendEmptySignatures(
    messageBytes: Uint8Array,
    numRequiredSignatures: number,
  ): Uint8Array {
    // `Uint8Array` is zero-initialized, so the signature slots default to the
    // all-zero placeholder without writing them explicitly.
    const wrapped = new Uint8Array(
      messageBytes.length + numRequiredSignatures * SIGNATURE_LENGTH,
    );
    wrapped.set(messageBytes, 0);
    return wrapped;
  }

  private buildReplacements(
    message: DecompiledV1Message,
    oldPayer: string,
    options: V1CraftOptions,
  ): Map<string, string> {
    const replacements = new Map<string, string>();

    if (options.payer !== undefined) {
      const newPayer = this.decodeAddress(options.payer);
      replacements.set(oldPayer, newPayer);
      this.seedAtaReplacements(message, oldPayer, newPayer, replacements);
    }

    if (options.replacements) {
      for (const [oldKey, newKey] of options.replacements) {
        const oldAddress = this.decodeAddress(oldKey);
        replacements.set(oldAddress, this.decodeAddress(newKey));
      }
    }

    return replacements;
  }

  private seedAtaReplacements(
    message: DecompiledV1Message,
    oldPayer: string,
    newPayer: string,
    replacements: Map<string, string>,
  ): void {
    const accounts = this.collectAccounts(message);
    const oldPayerKey = new PublicKey(oldPayer);
    const newPayerKey = new PublicKey(newPayer);

    for (const account of accounts) {
      if (account === oldPayer || replacements.has(account)) {
        continue;
      }

      const accountKey = new PublicKey(account);
      for (const mint of accounts) {
        const mintKey = new PublicKey(mint);
        for (const tokenProgram of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
          try {
            const oldAta = getAssociatedTokenAddressSync(
              mintKey,
              oldPayerKey,
              true,
              tokenProgram,
            );
            if (oldAta.equals(accountKey)) {
              const newAta = getAssociatedTokenAddressSync(
                mintKey,
                newPayerKey,
                true,
                tokenProgram,
              );
              replacements.set(account, newAta.toBase58());
            }
          } catch {
            // Not a valid ATA derivation for this mint and token program.
          }
        }
      }
    }
  }

  private collectAccounts(message: DecompiledV1Message): string[] {
    const seen = new Set<string>();
    const accounts: string[] = [];

    const add = (accountAddress: string): void => {
      if (!seen.has(accountAddress)) {
        seen.add(accountAddress);
        accounts.push(accountAddress);
      }
    };

    add(message.feePayer.address);
    for (const instruction of message.instructions) {
      add(instruction.programAddress);
      for (const account of instruction.accounts ?? []) {
        add(account.address);
      }
    }

    return accounts;
  }

  private decodeAddress(value: string): string {
    try {
      return new PublicKey(value.trim()).toBase58();
    } catch {
      throw new Error("Failed to decode public key from base58.");
    }
  }
}
