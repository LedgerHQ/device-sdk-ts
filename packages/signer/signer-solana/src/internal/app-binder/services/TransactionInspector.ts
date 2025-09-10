import {
  type PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Buffer } from "buffer";

import {
  DECODERS,
  type IxContext,
  type TxInspectorResult,
} from "@internal/app-binder/services/utils/transactionDecoders";

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

type LoadedAddresses = { writable: PublicKey[]; readonly: PublicKey[] };

export class TransactionInspector {
  constructor(private readonly rawTransactionBytes: Uint8Array) {}

  public inspectTransactionType(): TxInspectorResult {
    try {
      const message = this.normaliseMessage(this.rawTransactionBytes);

      for (const ixMeta of message.compiledInstructions) {
        const programId = message.allKeys[ixMeta.programIdIndex];
        if (!programId) continue;

        // resolve all referenced keys, if any are missing skip this
        const resolvedKeys = ixMeta.accountKeyIndexes
          .map((i) => message.allKeys[i])
          .filter((key): key is PublicKey => !!key);

        if (resolvedKeys.length !== ixMeta.accountKeyIndexes.length) {
          // unresolved keys, can't decode reliably
          continue;
        }

        const instruction = new TransactionInstruction({
          programId,
          keys: resolvedKeys.map((key) => ({
            pubkey: key,
            isSigner: false,
            isWritable: false,
          })),
          data: Buffer.from(ixMeta.data),
        });

        const ctx: IxContext = { programId, ixMeta, message, instruction };

        for (const decoder of DECODERS) {
          if (!decoder.when(ctx)) continue;
          const data = decoder.decode(ctx);
          if (data) {
            return { transactionType: SolanaTransactionTypes.SPL, data };
          }
        }
      }

      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    } catch {
      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    }
  }

  /**
   * Normalise any tx (legacy or v0) into { compiledInstructions, allKeys }.
   * If LUT accounts are provided, looked-up keys are included in allKeys.
   */
  private normaliseMessage(rawBytes: Uint8Array): NormalizedMessage {
    const versionedTX = this.tryDeserialiseVersioned(rawBytes);
    if (versionedTX) {
      const msg = versionedTX.message as VersionedMessage & {
        getAccountKeys?: (options?: {
          accountKeysFromLookups?: LoadedAddresses;
        }) => {
          staticAccountKeys: PublicKey[];
          accountKeysFromLookups?: LoadedAddresses;
          keySegments: () => PublicKey[][];
        };
        compiledInstructions: Array<{
          programIdIndex: number;
          accountKeyIndexes?: number[]; // legacy field name
          accounts?: number[]; // v0 field name
          data: Uint8Array | string | number[];
        }>;
        staticAccountKeys: PublicKey[];
      };

      // build the full key array in the exact index order used by compiledInstructions
      let allKeys: PublicKey[];
      if (typeof msg.getAccountKeys === "function") {
        const messageAccountKeys = msg.getAccountKeys();
        allKeys = messageAccountKeys.keySegments().flat();
      } else {
        // fallback to statics
        allKeys = [...msg.staticAccountKeys];
      }

      const compiledInstructions: NormalizedCompiledIx[] =
        msg.compiledInstructions.map((ix) => {
          // prefer v0 `accounts`, fall back to legacy `accountKeyIndexes`
          const ixWithAccounts = ix as typeof ix & { accounts?: number[] };
          const accountKeyIndexes = Array.from(
            ixWithAccounts.accounts ?? ix.accountKeyIndexes ?? [],
          ) as number[];

          // normalise data
          let data: Uint8Array;
          if (ix.data instanceof Uint8Array) {
            data = ix.data;
          } else if (typeof ix.data === "string") {
            // v0 encodes instruction data as base64 strings
            data = Buffer.from(ix.data, "base64");
          } else {
            data = Uint8Array.from(ix.data ?? []);
          }

          return {
            programIdIndex: ix.programIdIndex,
            accountKeyIndexes,
            data,
          };
        });

      return { compiledInstructions, allKeys };
    }

    // legacy fallback
    const legacy = Transaction.from(rawBytes);

    const allKeyMap = new Map<string, PublicKey>();
    const add = (pubkey?: PublicKey | null) => {
      if (!pubkey) return;
      const key = pubkey.toBase58();
      if (!allKeyMap.has(key)) allKeyMap.set(key, pubkey);
    };

    add(legacy.feePayer ?? null);
    for (const ix of legacy.instructions) {
      add(ix.programId);
      for (const key of ix.keys) add(key.pubkey);
    }
    const allKeys = Array.from(allKeyMap.values());
    const indexByB58 = new Map(allKeys.map((pk, i) => [pk.toBase58(), i]));

    const compiledInstructions: NormalizedCompiledIx[] =
      legacy.instructions.map((ix) => ({
        programIdIndex: indexByB58.get(ix.programId.toBase58()) ?? -1,
        accountKeyIndexes: ix.keys.map(
          (key) => indexByB58.get(key.pubkey.toBase58()) ?? -1,
        ),
        data: ix.data,
      }));

    return { compiledInstructions, allKeys };
  }

  private tryDeserialiseVersioned(
    rawBytes: Uint8Array,
  ): VersionedTransaction | null {
    try {
      return VersionedTransaction.deserialize(rawBytes);
    } catch {
      try {
        const msg = VersionedMessage.deserialize(rawBytes);
        // wrap in a dummy VersionedTransaction-like shape just for uniform handling
        return { message: msg } as VersionedTransaction;
      } catch {
        return null;
      }
    }
  }
}
