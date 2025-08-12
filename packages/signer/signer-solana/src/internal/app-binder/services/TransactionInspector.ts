import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  decodeInitializeAccountInstruction,
  decodeTransferCheckedInstruction,
  decodeTransferInstruction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TokenInstruction,
} from "@solana/spl-token";
import {
  type PublicKey,
  Transaction,
  TransactionInstruction,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Buffer } from "buffer";

export enum SolanaTransactionTypes {
  STANDARD = "Standard",
  SPL = "SPL",
}

export interface TxInspectorResult {
  transactionType: SolanaTransactionTypes;
  data: {
    tokenAddress?: string;
    mintAddress?: string;
    createATA?: {
      address: string;
      mintAddress: string;
    };
  };
}

type NormalizedCompiledIx = {
  programIdIndex: number;
  accountKeyIndexes: number[];
  data: Uint8Array;
};

type NormalizedMessage = {
  compiledInstructions: NormalizedCompiledIx[];
  allKeys: PublicKey[];
};

type LoadedAddresses = { writable: PublicKey[]; readonly: PublicKey[] };

export class TransactionInspector {
  /**
   * @param rawTransactionBytes - the raw tx bytes (legacy or v0)
   */
  constructor(private readonly rawTransactionBytes: Uint8Array) {}

  public inspectTransactionType(): TxInspectorResult {
    try {
      const message = this.normaliseMessage(this.rawTransactionBytes);

      for (const ixMeta of message.compiledInstructions) {
        const programId = message.allKeys[ixMeta.programIdIndex];
        if (!programId) continue;

        // Associated Token Account (ATA) Program: detect ATA creation
        if (programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
          // expected accounts: [payer, ata, owner, mint, systemProgram, tokenProgram, rent?]
          const accountPks = ixMeta.accountKeyIndexes
            .map((i) => message.allKeys[i])
            .filter(Boolean) as PublicKey[];
          const ataPk = accountPks[1];
          const mintPk = accountPks[3];
          if (ataPk && mintPk) {
            return {
              transactionType: SolanaTransactionTypes.SPL,
              data: {
                createATA: {
                  address: ataPk.toBase58(),
                  mintAddress: mintPk.toBase58(),
                },
              },
            };
          }
          continue;
        }

        // Token Program (classic or 2022)
        const isTokenProgram =
          programId.equals(TOKEN_PROGRAM_ID) ||
          programId.equals(TOKEN_2022_PROGRAM_ID);
        if (!isTokenProgram) continue;

        // minimal TransactionInstruction for the decoders
        const instruction = new TransactionInstruction({
          programId,
          keys: ixMeta.accountKeyIndexes.map((i) => {
            if (!message.allKeys[i]) {
              throw new Error(
                `TransactionInspector: missing key at index ${i} in allKeys`,
              );
            }
            return {
              pubkey: message.allKeys[i],
              isSigner: false,
              isWritable: false,
            };
          }),
          data: Buffer.from(ixMeta.data),
        });

        const instructionType = instruction.data[0];

        try {
          switch (instructionType) {
            case TokenInstruction.Transfer: {
              const {
                keys: { destination },
              } = decodeTransferInstruction(instruction);
              return {
                transactionType: SolanaTransactionTypes.SPL,
                data: { tokenAddress: destination.pubkey.toBase58() },
              };
            }
            case TokenInstruction.TransferChecked: {
              const {
                keys: { destination, mint },
              } = decodeTransferCheckedInstruction(instruction);
              return {
                transactionType: SolanaTransactionTypes.SPL,
                data: {
                  tokenAddress: destination.pubkey.toBase58(),
                  mintAddress: mint.pubkey.toBase58(),
                },
              };
            }
            case TokenInstruction.InitializeAccount: {
              // InitializeAccount != ATA creation, ATA is via the Associated Token Account Program above.
              const {
                keys: { account, mint },
              } = decodeInitializeAccountInstruction(instruction);
              return {
                transactionType: SolanaTransactionTypes.SPL,
                data: {
                  createATA: {
                    address: account.pubkey.toBase58(),
                    mintAddress: mint.pubkey.toBase58(),
                  },
                },
              };
            }
            default:
              // not a token instruction we care about—keep scanning.
              break;
          }
        } catch {
          // if a decoder throws (bad match), keep scanning other instructions.
          continue;
        }
      }

      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    } catch {
      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    }
  }

  /**
   * normalise any tx (legacy or v0) into { compiledInstructions, allKeys }.
   * if LUT accounts are provided, looked-up keys are included in allKeys.
   */
  private normaliseMessage(rawBytes: Uint8Array): NormalizedMessage {
    const vtx = this.tryDeserialiseVersioned(rawBytes);
    if (vtx) {
      const msg = vtx.message as VersionedMessage & {
        getAccountKeys?: (opts?: {
          accountKeysFromLookups?: LoadedAddresses;
        }) => {
          staticAccountKeys: PublicKey[];
          accountKeysFromLookups?: LoadedAddresses;
          keySegments: () => PublicKey[][];
        };
        compiledInstructions: Array<{
          programIdIndex: number;
          accountKeyIndexes?: number[];
          accounts?: number[];
          data: Uint8Array | string | number[];
        }>;
        staticAccountKeys: PublicKey[];
      };

      // build the full key array in the exact index order used by compiledInstructions
      let allKeys: PublicKey[];
      if (typeof msg.getAccountKeys === "function") {
        const mak = msg.getAccountKeys();
        allKeys = mak.keySegments().flat();
      } else {
        // very old builds: fall back to concatenation (same order)
        allKeys = [...msg.staticAccountKeys];
      }

      const compiledInstructions: NormalizedCompiledIx[] =
        msg.compiledInstructions.map((ix) => ({
          programIdIndex: ix.programIdIndex,
          accountKeyIndexes: Array.from(ix.accountKeyIndexes ?? []),
          data:
            ix.data instanceof Uint8Array
              ? ix.data
              : Buffer.from(ix.data ?? []),
        }));

      return { compiledInstructions, allKeys };
    }

    // legacy fallback
    const legacy = Transaction.from(rawBytes);

    const allKeyMap = new Map<string, PublicKey>();
    const add = (pk?: PublicKey | null) => {
      if (!pk) return;
      const k = pk.toBase58();
      if (!allKeyMap.has(k)) allKeyMap.set(k, pk);
    };

    add(legacy.feePayer ?? null);
    for (const ix of legacy.instructions) {
      add(ix.programId);
      for (const k of ix.keys) add(k.pubkey);
    }
    const allKeys = Array.from(allKeyMap.values());
    const indexByB58 = new Map(allKeys.map((pk, i) => [pk.toBase58(), i]));

    const compiledInstructions: NormalizedCompiledIx[] =
      legacy.instructions.map((ix) => ({
        programIdIndex: indexByB58.get(ix.programId.toBase58()) ?? -1,
        accountKeyIndexes: ix.keys.map(
          (k) => indexByB58.get(k.pubkey.toBase58()) ?? -1,
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
