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
  allKeys: PublicKey[]; // may exclude LUT keys if not provided
};

type LoadedAddresses = { writable: PublicKey[]; readonly: PublicKey[] };

export class TransactionInspector {
  /**
   * @param rawTransactionBytes - raw bytes of the transaction to inspect
   * @param lookedUpAddresses - optional hydrated LUT keys
   */
  constructor(
    private readonly rawTransactionBytes: Uint8Array,
    private readonly lookedUpAddresses?: LoadedAddresses,
  ) {}

  public inspectTransactionType(): TxInspectorResult {
    try {
      const message = this.normaliseMessage(this.rawTransactionBytes);

      for (const ixMeta of message.compiledInstructions) {
        const programId = message.allKeys[ixMeta.programIdIndex];
        const instructionType = ixMeta.data?.[0];

        const isTokenProgram =
          !!programId &&
          (programId.equals(TOKEN_PROGRAM_ID) ||
            programId.equals(TOKEN_2022_PROGRAM_ID));

        // exact decode when we know it's the token program (classic or 2022)
        if (isTokenProgram) {
          try {
            const instruction = new TransactionInstruction({
              programId,
              keys: ixMeta.accountKeyIndexes.map((i) => {
                const pk = message.allKeys[i];
                if (!pk) {
                  throw new Error(
                    `TransactionInspector: missing key at index ${i} in allKeys`,
                  );
                }
                return { pubkey: pk, isSigner: false, isWritable: false };
              }),
              data: Buffer.from(ixMeta.data),
            });

            switch (instruction.data[0]) {
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
                // keep scanning
                break;
            }
          } catch {
            // if the decoder throws, keep scanning other instructions
          }
        }

        // detect ATA creation (exact: only when programId is present & matches)
        if (programId && programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
          // expected accounts: [payer, ata, owner, mint, systemProgram, tokenProgram, rent?]
          const getPk = (idx: number) => {
            const keyIndex = ixMeta.accountKeyIndexes[idx];
            return keyIndex !== undefined
              ? message.allKeys[keyIndex]
              : undefined;
          };
          const ataPk = getPk(1);
          const mintPk = getPk(3);
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
        }

        // fallback when programId is unresolved
        // map account positions directly and return any addresses that are available in the static set
        const looksLikeSplOpcode =
          instructionType === TokenInstruction.Transfer ||
          instructionType === TokenInstruction.TransferChecked ||
          instructionType === TokenInstruction.InitializeAccount;

        if (!programId && looksLikeSplOpcode) {
          const keys = ixMeta.accountKeyIndexes;

          const keyAt = (pos: number): string | undefined => {
            const keyIndex = keys[pos];
            if (keyIndex === undefined) return undefined;
            const pk = message.allKeys[keyIndex];
            return pk ? pk.toBase58() : undefined;
          };

          if (instructionType === TokenInstruction.Transfer) {
            // accounts: [source, destination, owner, (...signers)]
            const destination = keyAt(1);
            if (destination) {
              return {
                transactionType: SolanaTransactionTypes.SPL,
                data: { tokenAddress: destination },
              };
            }
            // if can't resolve any useful address, still mark SPL
            return { transactionType: SolanaTransactionTypes.SPL, data: {} };
          }

          if (instructionType === TokenInstruction.TransferChecked) {
            // accounts: [source, mint, destination, owner, (...signers)]
            const mint = keyAt(1);
            const destination = keyAt(2);
            if (destination || mint) {
              return {
                transactionType: SolanaTransactionTypes.SPL,
                data: {
                  ...(destination ? { tokenAddress: destination } : {}),
                  ...(mint ? { mintAddress: mint } : {}),
                },
              };
            }
            return { transactionType: SolanaTransactionTypes.SPL, data: {} };
          }

          if (instructionType === TokenInstruction.InitializeAccount) {
            // accounts: [account, mint, owner, rent]
            const account = keyAt(0);
            const mint = keyAt(1);
            if (account || mint) {
              return {
                transactionType: SolanaTransactionTypes.SPL,
                data: {
                  createATA: {
                    address: account ?? "",
                    mintAddress: mint ?? "",
                  },
                },
              };
            }
            return { transactionType: SolanaTransactionTypes.SPL, data: {} };
          }
        }
      }

      // nothing matched
      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    } catch {
      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    }
  }

  /**
   * normalize legacy or v0 messages into { compiledInstructions, allKeys }.
   * if `lookedUpAddresses` is provided, it will be included; otherwise only static keys are present.
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

      // build key list in the exact index order used by compiledInstructions.
      let allKeys: PublicKey[];
      if (typeof msg.getAccountKeys === "function") {
        const mak = msg.getAccountKeys({
          accountKeysFromLookups: this.lookedUpAddresses, // may be undefined
        });
        allKeys = mak.keySegments().flat(); // static + (optionally) looked-up, in correct order
      } else {
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
        return { message: msg } as VersionedTransaction;
      } catch {
        return null;
      }
    }
  }
}
