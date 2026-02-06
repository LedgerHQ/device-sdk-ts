import {
  type PublicKey,
  Transaction,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Buffer } from "buffer";

import {
  type NormalizedCompiledIx,
  type NormalizedMessage,
} from "@internal/app-binder/services/TransactionInspector";

import { type AddressLookupTableResolver } from "./AddressLookupTableResolver";

/**
 * Output of the parsing step — a format-agnostic representation of
 * the transaction plus metadata needed for blind-sign detection.
 */
export type ParsedTransaction = {
  message: NormalizedMessage;
  usesAddressLookupTables: boolean;
};

/**
 * Handles raw transaction bytes → normalised message.
 *
 * Supports both legacy and versioned (v0) transactions.
 * If an {@link AddressLookupTableResolver} is provided, v0 ALT
 * addresses are resolved and merged into the key list.
 */
export class TransactionParser {
  constructor(
    private readonly altResolver?: AddressLookupTableResolver,
  ) {}

  /**
   * Parse raw transaction bytes into a {@link ParsedTransaction}.
   */
  async parse(rawBytes: Uint8Array): Promise<ParsedTransaction> {
    const usesAddressLookupTables =
      TransactionParser.hasAddressLookupTables(rawBytes);

    const message = await this.normaliseMessage(rawBytes);

    return { message, usesAddressLookupTables };
  }

  /**
   * Check whether the raw bytes represent a versioned transaction
   * that uses address lookup tables (ALTs).
   */
  static hasAddressLookupTables(rawBytes: Uint8Array): boolean {
    const versionedTx = TransactionParser.tryDeserialiseVersioned(rawBytes);
    if (!versionedTx) return false; // legacy transaction, no ALTs
    const msg = versionedTx.message as VersionedMessage;
    const lookups = msg.addressTableLookups ?? [];
    return lookups.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Normalise any tx (legacy or v0) into { compiledInstructions, allKeys }.
   * For v0, auto-resolve looked-up addresses from ALT(s) via the resolver.
   */
  private async normaliseMessage(
    rawBytes: Uint8Array,
  ): Promise<NormalizedMessage> {
    const versionedTx = TransactionParser.tryDeserialiseVersioned(rawBytes);

    if (versionedTx) {
      return this.normaliseVersionedMessage(versionedTx);
    }

    return TransactionParser.normaliseLegacyMessage(rawBytes);
  }

  private async normaliseVersionedMessage(
    versionedTx: VersionedTransaction,
  ): Promise<NormalizedMessage> {
    const msg = versionedTx.message as VersionedMessage & {
      compiledInstructions: Array<{
        programIdIndex: number;
        accountKeyIndexes?: number[]; // legacy field name
        accounts?: number[]; // v0 field name
        data: Uint8Array | string | number[];
      }>;
      staticAccountKeys: PublicKey[];
    };

    const lookedUp = this.altResolver
      ? await this.altResolver.resolve(msg)
      : undefined;

    const allKeys: PublicKey[] = [
      ...msg.staticAccountKeys,
      ...(lookedUp?.writable ?? []),
      ...(lookedUp?.readonly ?? []),
    ];

    const compiledInstructions: NormalizedCompiledIx[] =
      msg.compiledInstructions.map((instruction) => {
        const ixWithAccounts = instruction as typeof instruction & {
          accounts?: number[];
        };

        const accountKeyIndexes = Array.from(
          ixWithAccounts.accounts ?? instruction.accountKeyIndexes ?? [],
        ) as number[];

        let data: Uint8Array;
        if (instruction.data instanceof Uint8Array) {
          data = instruction.data;
        } else if (typeof instruction.data === "string") {
          data = Buffer.from(instruction.data, "base64"); // v0 encodes data as base64
        } else {
          data = Uint8Array.from(instruction.data ?? []);
        }

        return {
          programIdIndex: instruction.programIdIndex,
          accountKeyIndexes,
          data,
        };
      });

    return { compiledInstructions, allKeys };
  }

  private static normaliseLegacyMessage(
    rawBytes: Uint8Array,
  ): NormalizedMessage {
    const legacy = Transaction.from(rawBytes);

    const allKeyMap = new Map<string, PublicKey>();

    const add = (pubkey?: PublicKey | null) => {
      if (!pubkey) return;
      const key = pubkey.toBase58();
      if (!allKeyMap.has(key)) allKeyMap.set(key, pubkey);
    };

    add(legacy.feePayer ?? null);

    for (const instruction of legacy.instructions) {
      add(instruction.programId);
      for (const key of instruction.keys) add(key.pubkey);
    }

    const allKeys = Array.from(allKeyMap.values());
    const indexByB58 = new Map(allKeys.map((pk, i) => [pk.toBase58(), i]));

    const compiledInstructions: NormalizedCompiledIx[] =
      legacy.instructions.map((instruction) => ({
        programIdIndex:
          indexByB58.get(instruction.programId.toBase58()) ?? -1,
        accountKeyIndexes: instruction.keys.map(
          (key) => indexByB58.get(key.pubkey.toBase58()) ?? -1,
        ),
        data: instruction.data,
      }));

    return { compiledInstructions, allKeys };
  }

  private static tryDeserialiseVersioned(
    rawBytes: Uint8Array,
  ): VersionedTransaction | null {
    try {
      return VersionedTransaction.deserialize(rawBytes);
    } catch {
      try {
        const msg = VersionedMessage.deserialize(rawBytes);
        return { message: msg } as VersionedTransaction;
      } catch {
        return null;
      }
    }
  }
}
