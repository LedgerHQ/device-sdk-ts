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

        const instructionType = instruction.data[0];
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
              keys: { destination },
            } = decodeTransferCheckedInstruction(instruction);
            return {
              transactionType: SolanaTransactionTypes.SPL,
              data: { tokenAddress: destination.pubkey.toBase58() },
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
            continue;
        }
      }

      return {
        transactionType: SolanaTransactionTypes.STANDARD,
        data: {},
      };
    } catch {
      return {
        transactionType: SolanaTransactionTypes.STANDARD,
        data: {},
      };
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
        new Map(
          (allKeys.filter(Boolean) as PublicKey[]).map((pk) => [
            pk.toBase58(),
            pk,
          ]),
        ).values(),
      );

      interface CustomCompiledInstruction {
        programIdIndex: number;
        accountKeyIndexes: number[];
        data: Uint8Array;
      }

      return {
        compiledInstructions: tx.instructions.map(
          (ix): CustomCompiledInstruction => ({
            programIdIndex: staticAccountKeys.findIndex((k) =>
              k.equals(ix.programId),
            ),
            accountKeyIndexes: ix.keys.map((k) =>
              staticAccountKeys.findIndex((s) => s.equals(k.pubkey)),
            ),
            data: ix.data,
          }),
        ),
        staticAccountKeys,
        isAccountSigner: (i: number) =>
          tx.signatures.some((sig) =>
            sig.publicKey.equals(staticAccountKeys[i]!),
          ),
        isAccountWritable: () => true,
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
