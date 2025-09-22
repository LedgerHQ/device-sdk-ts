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
};

type LoadedAddresses = { writable: PublicKey[]; readonly: PublicKey[] };

const RPC_URL = "https://api.mainnet-beta.solana.com/";

const defaultConnection = (rpcUrl: string) =>
  new Connection(rpcUrl, { commitment: "confirmed" });

const isSPLProgramId = (pid: PublicKey | undefined) =>
  !!pid &&
  (pid.equals(ASSOCIATED_TOKEN_PROGRAM_ID) ||
    pid.equals(TOKEN_PROGRAM_ID) ||
    pid.equals(TOKEN_2022_PROGRAM_ID));

export class TransactionInspector {
  constructor(
    private readonly rawTransactionBytes: Uint8Array,
    private readonly tokenAddress?: string | undefined,
    private readonly createATA?:
      | {
          address: string;
          mintAddress: string;
        }
      | undefined,
    private readonly injectedRPCURL?: string | undefined,
  ) {}

  public async inspectTransactionType(): Promise<TxInspectorResult> {
    try {
      const message = await this.normaliseMessage(this.rawTransactionBytes);

      // fast path when transaction resolution is provided
      if (this.tokenAddress || this.createATA) {
        const looksSPL = message.compiledInstructions.some((instruction) =>
          isSPLProgramId(message.allKeys[instruction.programIdIndex]),
        );
        return {
          transactionType: looksSPL
            ? SolanaTransactionTypes.SPL
            : SolanaTransactionTypes.STANDARD,
          data: {
            ...(this.tokenAddress ? { tokenAddress: this.tokenAddress } : {}),
            ...(this.createATA ? { createATA: this.createATA } : {}),
          },
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

          // prefer createATA (needed when destination ATA doesn’t exist yet)
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
        return { transactionType: SolanaTransactionTypes.SPL, data: best };

      if (best.tokenAddress)
        return { transactionType: SolanaTransactionTypes.SPL, data: best };

      if (sawSPL)
        return { transactionType: SolanaTransactionTypes.SPL, data: {} }; // we should never reach here, in case we do tx will fall back to blind sign

      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    } catch {
      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    }
  }

  /**
   * Normalise any tx (legacy or v0) into { compiledInstructions, allKeys }.
   * For v0, auto-fetch looked-up addresses from ALT(s) via the connection.
   */
  private async normaliseMessage(
    rawBytes: Uint8Array,
  ): Promise<NormalizedMessage> {
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

      const lookedUp = await this.resolveLookedUpAddressesFromMessage(msg);

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

  private tryDeserialiseVersioned(
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
  private async resolveLookedUpAddressesFromMessage(
    msg: VersionedMessage,
  ): Promise<LoadedAddresses | undefined> {
    const lookups = msg.addressTableLookups ?? [];
    if (!lookups.length) return;

    const writable: PublicKey[] = [];
    const readonly: PublicKey[] = [];

    for (const lu of lookups) {
      const res = await defaultConnection(
        this.injectedRPCURL || RPC_URL,
      ).getAddressLookupTable(lu.accountKey);
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
