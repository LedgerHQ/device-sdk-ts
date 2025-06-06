import {
  type DecodedInstruction,
  decodeInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Transaction,
  type TransactionInstruction,
  VersionedMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export enum SolanaTransactionTypes {
  STANDARD = "Standard",
  SPL = "SPL",
}

export interface TxInspectorResult {
  transactionType: SolanaTransactionTypes;
  data: {
    tokenAddress?: string;
    createATA?: { address: string; mintAddress: string };
  };
}

type SplInstructionDetail = {
  instructionIndex: number;
  programIdIndex: number;
  accountIndexes: number[];
  instructionData: Uint8Array;
};

export class TransactionInspector {
  constructor(private readonly rawTransaction: Uint8Array | Buffer | string) {}

  public async run(): Promise<TxInspectorResult> {
    const versionedMessage = this.parseToVersionedMessage(this.rawTransaction);

    const splInstructions: SplInstructionDetail[] = [];

    versionedMessage.compiledInstructions.forEach(
      (compiledIx, instructionIndex) => {
        const programId =
          versionedMessage.staticAccountKeys[compiledIx.programIdIndex]!;
        if (!programId.equals(TOKEN_PROGRAM_ID)) return;

        const accountIndexes = compiledIx.accountKeyIndexes;
        const instructionData =
          typeof compiledIx.data === "string"
            ? bs58.decode(compiledIx.data)
            : compiledIx.data;

        splInstructions.push({
          instructionIndex,
          programIdIndex: compiledIx.programIdIndex,
          accountIndexes,
          instructionData,
        });
      },
    );

    if (splInstructions.length === 0) {
      return { transactionType: SolanaTransactionTypes.STANDARD, data: {} };
    }

    const firstSplInstruction = splInstructions[0];

    if (!firstSplInstruction) {
      throw new Error("No SPL instructions found in the transaction");
    }

    const {
      mint: mintAddressString,
      authority: authorityAddressString,
      source: sourceAccountString,
      destination: destinationAccountString,
    } = this.decodeSplInstruction(versionedMessage, firstSplInstruction);

    const mintPublicKey = new PublicKey(mintAddressString);
    const authorityPublicKey = new PublicKey(authorityAddressString);
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      authorityPublicKey,
    );
    const associatedTokenAccountAddress = associatedTokenAccount.toBase58();

    const relevantAccount = sourceAccountString ?? destinationAccountString;
    const isAtaExisting =
      relevantAccount !== undefined &&
      new PublicKey(relevantAccount).equals(associatedTokenAccount);

    return {
      transactionType: SolanaTransactionTypes.SPL,
      data: isAtaExisting
        ? { tokenAddress: associatedTokenAccountAddress }
        : {
            createATA: {
              address: associatedTokenAccountAddress,
              mintAddress: mintPublicKey.toBase58(),
            },
          },
    };
  }

  private parseToVersionedMessage(
    rawPayload: Uint8Array | Buffer | string,
  ): VersionedMessage {
    const bufferData =
      typeof rawPayload === "string"
        ? Buffer.from(rawPayload, "base64")
        : rawPayload;
    const byteArray = new Uint8Array(bufferData);
    if (byteArray.length === 0 || !byteArray[0]) {
      throw new Error("Transaction data is empty");
    }

    const messageTypeTag = byteArray[0] >> 6;
    if (messageTypeTag === 0) {
      const legacyTx = Transaction.from(byteArray);
      return VersionedMessage.deserialize(legacyTx.serializeMessage());
    }

    return VersionedTransaction.deserialize(byteArray).message;
  }

  private isTransferInstruction(
    decodedInstruction: DecodedInstruction,
  ): decodedInstruction is DecodedInstruction & {
    data: {
      mint: PublicKey;
      authority: PublicKey;
      source: PublicKey;
      destination: PublicKey;
    };
  } {
    return (
      typeof decodedInstruction.data === "object" &&
      decodedInstruction.data !== null &&
      "source" in decodedInstruction.data &&
      "destination" in decodedInstruction.data
    );
  }

  private isAccountCreationInstruction(
    decodedInstruction: DecodedInstruction,
  ): decodedInstruction is DecodedInstruction & {
    data: { mint: PublicKey; authority: PublicKey; account: PublicKey };
  } {
    const instructionData = decodedInstruction.data;
    return (
      instructionData !== null &&
      typeof instructionData === "object" &&
      "account" in (instructionData as Record<string, unknown>)
    );
  }

  private decodeSplInstruction(
    versionedMessage: VersionedMessage,
    splDetail: SplInstructionDetail,
  ): {
    mint: string;
    authority: string;
    source?: string;
    destination?: string;
  } {
    const programId =
      versionedMessage.staticAccountKeys[splDetail.programIdIndex];
    const accountMeta = splDetail.accountIndexes.map((index) => {
      const pubkey = versionedMessage.staticAccountKeys[index];
      if (!pubkey) {
        throw new Error(`Invalid account index ${index} in SPL instruction`);
      }
      return {
        pubkey,
        isSigner: false,
        isWritable: false,
      };
    });

    if (!programId) {
      throw new Error("Invalid program ID index in SPL instruction");
    }
    if (accountMeta.length < 2) {
      throw new Error("Not enough accounts in SPL instruction");
    }

    const transactionInstruction: TransactionInstruction = {
      programId,
      data: Buffer.from(splDetail.instructionData),
      keys: accountMeta,
    };

    const decoded = decodeInstruction(transactionInstruction);
    if (decoded instanceof Error) throw decoded;

    if (this.isTransferInstruction(decoded)) {
      return {
        mint: decoded.data.mint.toBase58(),
        authority: decoded.data.authority.toBase58(),
        source: decoded.data.source.toBase58(),
        destination: decoded.data.destination.toBase58(),
      };
    }

    if (this.isAccountCreationInstruction(decoded)) {
      const { mint, authority, account } = decoded.data;
      const accountAddress = account.toBase58();
      return {
        mint: mint.toBase58(),
        authority: authority.toBase58(),
        source: accountAddress,
        destination: accountAddress,
      };
    }

    throw new Error("Unsupported SPL instruction");
  }
}
