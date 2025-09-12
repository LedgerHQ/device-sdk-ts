import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection, // runtime import so we can instantiate it
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

const RPC_URL = "http://api.mainnet-beta.solana.com/";

const defaultConnection = new Connection(RPC_URL, { commitment: "confirmed" });

const isSPLProgramId = (pid: PublicKey | undefined) =>
  !!pid &&
  (pid.equals(ASSOCIATED_TOKEN_PROGRAM_ID) ||
    pid.equals(TOKEN_PROGRAM_ID) ||
    pid.equals(TOKEN_2022_PROGRAM_ID));

export class TransactionInspector {
  constructor(private readonly rawTransactionBytes: Uint8Array) {}

  public async inspectTransactionType(): Promise<TxInspectorResult> {
    try {
      const message = await this.normaliseMessage(this.rawTransactionBytes);

      for (const ixMeta of message.compiledInstructions) {
        const programId = message.allKeys[ixMeta.programIdIndex];
        if (!programId) continue;

        const resolvedKeys = ixMeta.accountKeyIndexes
          .map((i) => message.allKeys[i])
          .filter((key): key is PublicKey => !!key);

        // Build an instruction even with partial keys; decoders handle missing fields gracefully.
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

        if (isSPLProgramId(programId)) {
          return { transactionType: SolanaTransactionTypes.SPL, data: {} };
        }
      }

      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    } catch {
      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    }
  }

  /**
   * Normalise any tx (legacy or v0) into { compiledInstructions, allKeys }.
   * For v0, we auto-fetch looked-up addresses from ALT(s) via the baked-in connection.
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

      const lookedUp = await resolveLookedUpAddressesFromMessage(msg);

      let allKeys: PublicKey[];
      if (typeof msg.getAccountKeys === "function") {
        const messageAccountKeys = msg.getAccountKeys(
          lookedUp ? { accountKeysFromLookups: lookedUp } : undefined,
        );
        allKeys = messageAccountKeys.keySegments().flat();
      } else {
        allKeys = [...msg.staticAccountKeys];
      }

      const compiledInstructions: NormalizedCompiledIx[] =
        msg.compiledInstructions.map((ix) => {
          const ixWithAccounts = ix as typeof ix & { accounts?: number[] };
          const accountKeyIndexes = Array.from(
            ixWithAccounts.accounts ?? ix.accountKeyIndexes ?? [],
          ) as number[];

          let data: Uint8Array;
          if (ix.data instanceof Uint8Array) {
            data = ix.data;
          } else if (typeof ix.data === "string") {
            data = Buffer.from(ix.data, "base64"); // v0 encodes instruction data as base64
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

    // Legacy (no ALTs)
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
        // Wrap in a dummy VersionedTransaction-like shape just for uniform handling
        return { message: msg } as VersionedTransaction;
      } catch {
        return null;
      }
    }
  }
}

/** Internal: fetch looked-up addresses for a VersionedMessage via the baked-in connection. */
async function resolveLookedUpAddressesFromMessage(
  msg: VersionedMessage,
): Promise<LoadedAddresses | undefined> {
  const lookups = msg.addressTableLookups ?? [];
  if (!lookups.length) return;

  const writable: PublicKey[] = [];
  const readonly: PublicKey[] = [];

  await Promise.all(
    lookups.map(async (lu) => {
      const res = await defaultConnection.getAddressLookupTable(lu.accountKey);
      const table = res.value;
      if (!table) return;
      const addrs = table.state.addresses;

      for (const i of lu.writableIndexes ?? []) {
        const pk = addrs[i];
        if (pk) writable.push(pk);
      }
      for (const i of lu.readonlyIndexes ?? []) {
        const pk = addrs[i];
        if (pk) readonly.push(pk);
      }
    }),
  );

  return { writable, readonly };
}
