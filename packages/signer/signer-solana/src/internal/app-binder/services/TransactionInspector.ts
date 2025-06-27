import {
  decodeInitializeAccountInstruction,
  decodeTransferCheckedInstruction,
  decodeTransferInstruction,
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
    createATA?: {
      address: string;
      mintAddress: string;
    };
  };
}

export enum SPLTransferType {
  Transfer = "Transfer",
  TransferChecked = "TransferChecked",
  InitializeAccount = "InitializeAccount",
  Other = "Other",
}

export class TransactionInspector {
  constructor(private readonly rawTransactionBytes: Uint8Array) {}

  public inspectTransactionType(): TxInspectorResult {
    try {
      const message = this.extractMessage(this.rawTransactionBytes);

      for (const ixMeta of message.compiledInstructions) {
        const programId = message.staticAccountKeys[ixMeta.programIdIndex]!;
        if (!programId.equals(TOKEN_PROGRAM_ID)) continue;

        const instruction = new TransactionInstruction({
          programId,
          keys: ixMeta.accountKeyIndexes.map((i) => ({
            pubkey: message.staticAccountKeys[i]!,
            isSigner: message.isAccountSigner(i),
            isWritable: message.isAccountWritable(i),
          })),
          data: Buffer.from(ixMeta.data),
        });

        switch (this.getSPLTransferType(instruction)) {
          case SPLTransferType.Transfer: {
            const {
              keys: { destination },
            } = decodeTransferInstruction(instruction);
            return {
              transactionType: SolanaTransactionTypes.SPL,
              data: { tokenAddress: destination.pubkey.toBase58() },
            };
          }
          case SPLTransferType.TransferChecked: {
            const {
              keys: { destination },
            } = decodeTransferCheckedInstruction(instruction);
            return {
              transactionType: SolanaTransactionTypes.SPL,
              data: { tokenAddress: destination.pubkey.toBase58() },
            };
          }
          case SPLTransferType.InitializeAccount: {
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
            // not one of the SPL transfers we care about
            continue;
        }
      }
      // fallback to standard transaction type if no SPL transfers found
      return {
        transactionType: SolanaTransactionTypes.STANDARD,
        data: {},
      };
    } catch (_e) {
      // failed to parse transaction or no SPL transfers found
      // fallback to standard transaction type
      return {
        transactionType: SolanaTransactionTypes.STANDARD,
        data: {},
      };
    }
  }

  private getSPLTransferType(ix: TransactionInstruction): SPLTransferType {
    if (!ix.programId.equals(TOKEN_PROGRAM_ID)) return SPLTransferType.Other;
    if (ix.data.length === 0) return SPLTransferType.Other;

    // data[0] is the instruction tag as per SPL-Token spec
    switch (ix.data[0] as TokenInstruction) {
      case TokenInstruction.Transfer:
        return SPLTransferType.Transfer;
      case TokenInstruction.TransferChecked:
        return SPLTransferType.TransferChecked;
      case TokenInstruction.InitializeAccount:
        return SPLTransferType.InitializeAccount;
      default:
        return SPLTransferType.Other;
    }
  }

  private extractMessage(rawBytes: Uint8Array): VersionedMessage {
    const errors: string[] = [];
    try {
      return VersionedTransaction.deserialize(rawBytes).message;
    } catch (e) {
      errors.push((e as Error).message);
    }
    try {
      return VersionedMessage.deserialize(rawBytes);
    } catch (e) {
      errors.push((e as Error).message);
    }
    try {
      const tx = Transaction.from(rawBytes);
      const allKeys = [
        tx.feePayer,
        ...tx.instructions.flatMap((ix) => ix.keys.map((k) => k.pubkey)),
      ];
      const staticAccountKeys = Array.from(
        new Set(allKeys.filter(Boolean) as PublicKey[]),
      );
      interface CustomCompiledInstruction {
        programIdIndex: number;
        accountKeyIndexes: number[];
        data: Uint8Array;
      }

      return {
        compiledInstructions: tx.instructions.map(
          (ix): CustomCompiledInstruction => ({
            programIdIndex: staticAccountKeys.findIndex((k: PublicKey) =>
              k.equals(ix.programId),
            ),
            accountKeyIndexes: ix.keys.map((k: { pubkey: PublicKey }): number =>
              staticAccountKeys.findIndex((s: PublicKey) => s.equals(k.pubkey)),
            ),
            data: ix.data,
          }),
        ),
        staticAccountKeys: staticAccountKeys,
        isAccountSigner: (i: number): boolean =>
          tx.signatures.some((sig: { publicKey: PublicKey }): boolean =>
            sig.publicKey.equals(staticAccountKeys[i]!),
          ),
        isAccountWritable: (_i: number): boolean => true,
      } as unknown as VersionedMessage;
    } catch (e) {
      errors.push((e as Error).message);
    }
    throw new Error(
      "Invalid transaction payload – all deserializers failed:\n" +
        errors.map((m, i) => `${i + 1}) ${m}`).join("\n"),
    );
  }
}
