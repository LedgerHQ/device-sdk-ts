import {
  decodeInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
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

interface ParsedSplInstruction {
  programIdIndex: number;
  accountIndexes: number[];
  data: Uint8Array;
}

type TransferCheckedData = {
  mint: PublicKey;
  authority: PublicKey;
  source: PublicKey;
  destination: PublicKey;
};

export class TransactionInspector {
  constructor(private readonly rawTransactionBytes: Uint8Array) {}

  public async inspectTransactionType(): Promise<TxInspectorResult> {
    try {
      const message = this.extractMessage(this.rawTransactionBytes);

      const splInstructions: ParsedSplInstruction[] =
        message.compiledInstructions
          .filter((instruction) => {
            const programId =
              message.staticAccountKeys[instruction.programIdIndex];
            return programId?.equals(TOKEN_PROGRAM_ID);
          })
          .map((instruction) => ({
            programIdIndex: instruction.programIdIndex,
            accountIndexes: instruction.accountKeyIndexes,
            data:
              instruction.data instanceof Uint8Array
                ? instruction.data
                : new Uint8Array(instruction.data),
          }));

      if (splInstructions.length === 0) {
        return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
      }

      for (const { programIdIndex, accountIndexes, data } of splInstructions) {
        const instruction = new TransactionInstruction({
          programId: message.staticAccountKeys[programIdIndex]!,
          keys: accountIndexes.map((index) => ({
            pubkey: message.staticAccountKeys[index]!,
            isSigner: message.isAccountSigner(index),
            isWritable: message.isAccountWritable(index),
          })),
          data: Buffer.from(data),
        });

        const decodedInstruction = decodeInstruction(instruction);
        if (decodedInstruction instanceof Error) continue;

        const decodedData = decodedInstruction.data;

        // transfer without mint info (likely a direct SPL transfer)
        if ("amount" in decodedData && !("mint" in decodedData)) {
          const destinationAccount = instruction.keys[2]?.pubkey;
          if (!destinationAccount) {
            throw new Error(
              "Transfer instruction does not have a destination key",
            );
          }
          return {
            transactionType: SolanaTransactionTypes.SPL,
            data: { tokenAddress: destinationAccount.toBase58() },
          };
        }

        // transferChecked or CreateAssociatedTokenAccount
        if (this.isTransferCheckedData(decodedData)) {
          const { mint, authority, source, destination } = decodedData;

          const associatedTokenAccount = await getAssociatedTokenAddress(
            mint,
            authority,
          );
          const isATAUsed =
            source.equals(associatedTokenAccount) ||
            destination.equals(associatedTokenAccount);

          if (isATAUsed) {
            return {
              transactionType: SolanaTransactionTypes.SPL,
              data: { tokenAddress: associatedTokenAccount.toBase58() },
            };
          } else {
            return {
              transactionType: SolanaTransactionTypes.SPL,
              data: {
                createATA: {
                  address: associatedTokenAccount.toBase58(),
                  mintAddress: mint.toBase58(),
                },
              },
            };
          }
        }
      }

      throw new Error(
        "Found SPL-token instructions, but none decoded as Transfer or TransferChecked",
      );
    } catch (_e) {
      return {
        transactionType: SolanaTransactionTypes.STANDARD,
        data: {}, // Fallback to standard if any error occurs
      };
    }
  }

  private isTransferCheckedData(data: unknown): data is TransferCheckedData {
    if (data === null || typeof data !== "object") return false;
    const d = data as Record<string, unknown>;
    return (
      "mint" in d &&
      d["mint"] instanceof PublicKey &&
      "authority" in d &&
      d["authority"] instanceof PublicKey &&
      "source" in d &&
      d["source"] instanceof PublicKey &&
      "destination" in d &&
      d["destination"] instanceof PublicKey
    );
  }

  private extractMessage(rawBytes: Uint8Array): VersionedMessage {
    const errors: string[] = [];

    try {
      return VersionedTransaction.deserialize(rawBytes).message;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    try {
      return VersionedMessage.deserialize(rawBytes);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    try {
      const legacyTx = Transaction.from(rawBytes);
      const accountKeys = legacyTx.instructions.flatMap((ix) =>
        ix.keys.map((k) => k.pubkey),
      );
      const staticAccountKeys = [
        ...new Set([legacyTx.feePayer, ...accountKeys]),
      ].filter(Boolean) as PublicKey[];

      return {
        compiledInstructions: legacyTx.instructions.map((ix) => ({
          programIdIndex: staticAccountKeys.findIndex((k) =>
            k.equals(ix.programId),
          ),
          accountKeyIndexes: ix.keys.map((k) =>
            staticAccountKeys.findIndex((key) => key.equals(k.pubkey)),
          ),
          data: ix.data,
        })),
        staticAccountKeys,
        isAccountSigner: (i: number) =>
          legacyTx.signatures.some((sig) =>
            sig.publicKey.equals(staticAccountKeys[i]!),
          ),
        isAccountWritable: (_: number) => true,
      } as unknown as VersionedMessage;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }

    throw new Error(
      "Invalid transaction payload – all deserializers failed:\n" +
        errors.map((msg, i) => `${i + 1}) ${msg}`).join("\n"),
    );
  }
}
