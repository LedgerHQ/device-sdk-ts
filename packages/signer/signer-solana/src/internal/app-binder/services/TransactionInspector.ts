import { type PublicKey } from "@solana/web3.js";

import { RpcAddressLookupTableResolver } from "@internal/app-binder/services/utils/AddressLookupTableResolver";
import { TransactionClassifier } from "@internal/app-binder/services/utils/TransactionClassifier";
import { TransactionParser } from "@internal/app-binder/services/utils/TransactionParser";

// ---------------------------------------------------------------------------
// Public types — re-exported so existing consumers keep working.
// ---------------------------------------------------------------------------

export enum SolanaTransactionTypes {
  STANDARD = "Standard",
  SPL = "SPL",
}

export type NormalizedCompiledIx = {
  programIdIndex: number;
  accountKeyIndexes: number[];
  data: Uint8Array;
};

export type NormalizedMessage = {
  compiledInstructions: NormalizedCompiledIx[];
  allKeys: PublicKey[];
};

export type TxInspectorResult = {
  transactionType: SolanaTransactionTypes;
  data: {
    tokenAddress?: string;
    createATA?: { address: string; mintAddress: string };
  };
  /** Base58-encoded program IDs of all instructions in the transaction. */
  programIds: string[];
  /** Total number of instructions in the transaction. */
  instructionCount: number;
  /** Whether the transaction uses address lookup tables (v0 with ALTs). */
  usesAddressLookupTables: boolean;
};

// ---------------------------------------------------------------------------
// Facade
// ---------------------------------------------------------------------------

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com/";

/**
 * Thin facade that orchestrates transaction parsing and classification.
 *
 * Internally delegates to:
 * - {@link TransactionParser} — deserialization, normalisation, ALT detection
 * - {@link TransactionClassifier} — type classification via the decoder chain
 */
export class TransactionInspector {
  private readonly parser: TransactionParser;
  private readonly classifier: TransactionClassifier;

  constructor(rpcUrl?: string) {
    const resolver = new RpcAddressLookupTableResolver(
      rpcUrl ?? DEFAULT_RPC_URL,
    );
    this.parser = new TransactionParser(resolver);
    this.classifier = new TransactionClassifier();
  }

  public async inspectTransactionType(
    rawTransactionBytes: Uint8Array,
    tokenAddress?: string | undefined,
    createATA?:
      | {
          address: string;
          mintAddress: string;
        }
      | undefined,
  ): Promise<TxInspectorResult> {
    const parsed = await this.parser.parse(rawTransactionBytes);

    const classification = this.classifier.classify(
      parsed.message,
      tokenAddress,
      createATA,
    );

    return {
      ...classification,
      programIds: TransactionInspector.extractProgramIds(parsed.message),
      instructionCount: parsed.message.compiledInstructions.length,
      usesAddressLookupTables: parsed.usesAddressLookupTables,
    };
  }

  /**
   * Check whether the raw transaction bytes represent a versioned transaction
   * that uses address lookup tables (ALTs).
   */
  static hasAddressLookupTables(rawBytes: Uint8Array): boolean {
    return TransactionParser.hasAddressLookupTables(rawBytes);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private static extractProgramIds(message: NormalizedMessage): string[] {
    const set = new Set<string>();
    for (const ix of message.compiledInstructions) {
      const pk = message.allKeys[ix.programIdIndex];
      if (pk) set.add(pk.toBase58());
    }
    return Array.from(set);
  }
}
