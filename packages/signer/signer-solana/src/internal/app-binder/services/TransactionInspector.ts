import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
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

type LoadedAddresses = { writable: PublicKey[]; readonly: PublicKey[] };

const DEFAULT_RPC_URL = "https://api.mainnet-beta.solana.com/";

const defaultConnection = (rpcUrl: string) =>
  new Connection(rpcUrl, { commitment: "confirmed" });

const isSPLProgramId = (pid: PublicKey | undefined) =>
  !!pid &&
  (pid.equals(ASSOCIATED_TOKEN_PROGRAM_ID) ||
    pid.equals(TOKEN_PROGRAM_ID) ||
    pid.equals(TOKEN_2022_PROGRAM_ID));

export class TransactionInspector {
  private readonly RPCURL: string | undefined;
  constructor(injectedRPCURL?: string | undefined) {
    this.RPCURL = injectedRPCURL;
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
    // Detect ALTs before normalization (normalization resolves them away)
    const usesAddressLookupTables =
      TransactionInspector.hasAddressLookupTables(rawTransactionBytes);

    const message = await TransactionInspector.normaliseMessage(
      rawTransactionBytes,
      this.RPCURL || DEFAULT_RPC_URL,
    );

    // Extract program IDs and instruction count
    const instructionCount = message.compiledInstructions.length;
    const programIdSet = new Set<string>();
    for (const ix of message.compiledInstructions) {
      const pk = message.allKeys[ix.programIdIndex];
      if (pk) programIdSet.add(pk.toBase58());
    }
    const programIds = Array.from(programIdSet);

    const baseFields = {
      programIds,
      instructionCount,
      usesAddressLookupTables,
    };

    // fast path when transaction resolution is provided
    if (tokenAddress || createATA) {
      const looksSPL = message.compiledInstructions.some((instruction) =>
        isSPLProgramId(message.allKeys[instruction.programIdIndex]),
      );
      return {
        transactionType: looksSPL
          ? SolanaTransactionTypes.SPL
          : SolanaTransactionTypes.STANDARD,
        data: {
          ...(tokenAddress ? { tokenAddress: tokenAddress } : {}),
          ...(createATA ? { createATA: createATA } : {}),
        },
        ...baseFields,
      };
    }

    // accumulate best data across all instructions
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
        } else if (
          data.tokenAddress &&
          !best.tokenAddress &&
          !best.createATA
        ) {
          best = { ...best, tokenAddress: data.tokenAddress };
        }
      }
    }

    if (best.createATA)
      return {
        transactionType: SolanaTransactionTypes.SPL,
        data: best,
        ...baseFields,
      };

    if (best.tokenAddress)
      return {
        transactionType: SolanaTransactionTypes.SPL,
        data: best,
        ...baseFields,
      };

    if (sawSPL)
      return {
        transactionType: SolanaTransactionTypes.SPL,
        data: {},
        ...baseFields,
      }; // we should never reach here, in case we do tx will fall back to blind sign

    return {
      transactionType: SolanaTransactionTypes.STANDARD,
      data: {},
      ...baseFields,
    };
  }

  /**
   * Check whether the raw transaction bytes represent a versioned transaction
   * that uses address lookup tables (ALTs).
   */
  static hasAddressLookupTables(rawBytes: Uint8Array): boolean {
    const versionedTx =
      TransactionInspector.tryDeserialiseVersioned(rawBytes);
    if (!versionedTx) return false; // legacy transaction, no ALTs
    const msg = versionedTx.message as VersionedMessage;
    const lookups = msg.addressTableLookups ?? [];
    return lookups.length > 0;
  }

  /**
   * Normalise any tx (legacy or v0) into { compiledInstructions, allKeys }.
   * For v0, auto-fetch looked-up addresses from ALT(s) via the connection.
   */
  static async normaliseMessage(
    rawBytes: Uint8Array,
    rpcURL?: string,
  ): Promise<NormalizedMessage> {
    const versionedTX = TransactionInspector.tryDeserialiseVersioned(rawBytes);

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

      const lookedUp = rpcURL
        ? await TransactionInspector.resolveLookedUpAddressesFromMessage(
            msg,
            rpcURL,
          )
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
            data = Buffer.from(instruction.data, "base64"); // v0 encodes instruction data as base64
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

    // legacy (no ALTs)
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
        programIdIndex: indexByB58.get(instruction.programId.toBase58()) ?? -1,
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

  /**
   * For v0, fetch looked-up addresses from ALT(s) via the connection
   */
  private static async resolveLookedUpAddressesFromMessage(
    msg: VersionedMessage,
    rpcURL: string,
  ): Promise<LoadedAddresses | undefined> {
    const lookups = msg.addressTableLookups ?? [];
    if (!lookups.length) return;

    const writable: PublicKey[] = [];
    const readonly: PublicKey[] = [];

    for (const lu of lookups) {
      const res = await defaultConnection(rpcURL).getAddressLookupTable(
        lu.accountKey,
      );
      const table = res.value;
      if (!table) continue;
      const addrs = table.state.addresses;

      for (const i of lu.writableIndexes ?? []) {
        const pk = addrs[i];
        if (pk) writable.push(pk);
      }
      for (const i of lu.readonlyIndexes ?? []) {
        const pk = addrs[i];
        if (pk) readonly.push(pk);
      }
    }

    return { writable, readonly };
  }
}
