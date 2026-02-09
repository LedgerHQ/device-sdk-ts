import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { type PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Buffer } from "buffer";

import {
  type NormalizedMessage,
  SolanaTransactionTypes,
  type TxInspectorResult,
} from "@internal/app-binder/services/TransactionInspector";

import { DECODERS, type IxContext } from "./transactionDecoders";

/**
 * Result of the classification step — transaction type + extracted data.
 */
export type TransactionClassification = {
  transactionType: SolanaTransactionTypes;
  data: TxInspectorResult["data"];
};

const isSPLProgramId = (pid: PublicKey | undefined) =>
  !!pid &&
  (pid.equals(ASSOCIATED_TOKEN_PROGRAM_ID) ||
    pid.equals(TOKEN_PROGRAM_ID) ||
    pid.equals(TOKEN_2022_PROGRAM_ID));

/**
 * Classifies a normalised Solana transaction message as SPL or Standard
 * and extracts token-related data using the decoder chain.
 *
 * This class contains no parsing or I/O — it works purely on an already-
 * normalised message, making it easy to test in isolation.
 */
export class TransactionClassifier {
  /**
   * Classify the transaction.
   *
   * When resolution overrides (`tokenAddress` / `createATA`) are supplied,
   * a fast path is taken that skips the full decoder loop.
   */
  classify(
    message: NormalizedMessage,
    tokenAddress?: string,
    createATA?: { address: string; mintAddress: string },
  ): TransactionClassification {
    // fast path when transaction resolution is provided
    if (tokenAddress || createATA) {
      return this.classifyFromOverrides(message, tokenAddress, createATA);
    }

    return this.classifyFromDecoders(message);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private classifyFromOverrides(
    message: NormalizedMessage,
    tokenAddress?: string,
    createATA?: { address: string; mintAddress: string },
  ): TransactionClassification {
    const looksSPL = message.compiledInstructions.some((instruction) =>
      isSPLProgramId(message.allKeys[instruction.programIdIndex]),
    );

    return {
      transactionType: looksSPL
        ? SolanaTransactionTypes.SPL
        : SolanaTransactionTypes.STANDARD,
      data: {
        ...(tokenAddress ? { tokenAddress } : {}),
        ...(createATA ? { createATA } : {}),
      },
    };
  }

  private classifyFromDecoders(
    message: NormalizedMessage,
  ): TransactionClassification {
    let sawSPL = false;
    let best: TxInspectorResult["data"] = {};

    for (const ixMeta of message.compiledInstructions) {
      const programId = message.allKeys[ixMeta.programIdIndex];
      if (!programId) continue; // unresolved index, skip
      if (isSPLProgramId(programId)) sawSPL = true;

      const resolvedKeys = ixMeta.accountKeyIndexes
        .map((i) => message.allKeys[i])
        .filter((k): k is PublicKey => !!k);

      const instruction = new TransactionInstruction({
        programId,
        keys: resolvedKeys.map((pk) => ({
          pubkey: pk,
          isSigner: false,
          isWritable: false,
        })),
        data: Buffer.from(ixMeta.data),
      });

      const ctx: IxContext = { programId, ixMeta, message, instruction };

      for (const decoder of DECODERS) {
        if (!decoder.when(ctx)) continue;
        const data = decoder.decode(ctx);
        if (!data) continue;

        // prefer createATA (needed when destination ATA doesn't exist yet)
        if (data.createATA && !best.createATA) {
          best = { ...best, createATA: data.createATA };
        } else if (data.tokenAddress && !best.tokenAddress && !best.createATA) {
          best = { ...best, tokenAddress: data.tokenAddress };
        }
      }
    }

    if (best.createATA) {
      return {
        transactionType: SolanaTransactionTypes.SPL,
        data: best,
      };
    }

    if (best.tokenAddress) {
      return {
        transactionType: SolanaTransactionTypes.SPL,
        data: best,
      };
    }

    if (sawSPL) {
      return {
        transactionType: SolanaTransactionTypes.SPL,
        data: {},
      }; // last resort: we should never reach here; tx will fall back to blind sign
    }

    return {
      transactionType: SolanaTransactionTypes.STANDARD,
      data: {},
    };
  }
}
