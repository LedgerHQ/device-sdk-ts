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
  type AddressLookupTableAccount,
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

export class TransactionInspector {
  /**
   * @param rawTransactionBytes - the raw tx bytes (legacy or v0)
   * @param addressLookupTables - OPTIONAL: already-fetched LUT accounts to resolve looked-up keys
   */
  constructor(
    private readonly rawTransactionBytes: Uint8Array,
    private readonly addressLookupTables?: AddressLookupTableAccount[],
  ) {}

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
          keys: ixMeta.accountKeyIndexes.map((i) => ({
            pubkey: message.allKeys[i]!,
            isSigner: false,
            isWritable: false,
          })),
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
    // try versioned first (v0/any future versions supported by web3.js)
    const vtx = this.tryDeserialiseVersioned(rawBytes);
    if (vtx) {
      const msg = vtx.message;

      let writable: PublicKey[] = [];
      let readonly: PublicKey[] = [];

      // resolve looked-up keys when LUT accounts are provided
      try {
        if (this.addressLookupTables && "getAccountKeysFromLookups" in msg) {
          // @ts-expect-error: method available on v0 messages
          const fromLookups = msg.getAccountKeysFromLookups(
            this.addressLookupTables,
          );
          writable = fromLookups?.writable ?? [];
          readonly = fromLookups?.readonly ?? [];
        }
      } catch {
        // ignore; proceed with static keys only
      }

      const allKeys = [...msg.staticAccountKeys, ...writable, ...readonly];

      const compiledInstructions: NormalizedCompiledIx[] =
        msg.compiledInstructions.map(
          (ix: {
            programIdIndex: number;
            accountKeyIndexes?: number[];
            accounts?: number[];
            data: Uint8Array | string;
          }) => ({
            programIdIndex: ix.programIdIndex,
            accountKeyIndexes: Array.from(
              ix.accountKeyIndexes ?? ix.accounts ?? [],
            ),
            data:
              ix.data instanceof Uint8Array
                ? ix.data
                : Buffer.from(ix.data ?? []),
          }),
        );

      return { compiledInstructions, allKeys };
    }

    // fallback - legacy transaction
    const legacy = Transaction.from(rawBytes);

    // build a stable key list that includes fee payer, every ix programId, and all ix account metas.
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

    const compiledInstructions: NormalizedCompiledIx[] =
      legacy.instructions.map((ix) => ({
        programIdIndex: allKeys.findIndex((k) => k.equals(ix.programId)),
        accountKeyIndexes: ix.keys.map((k) =>
          allKeys.findIndex((s) => s.equals(k.pubkey)),
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
