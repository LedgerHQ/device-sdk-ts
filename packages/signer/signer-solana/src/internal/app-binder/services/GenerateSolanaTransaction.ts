import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

export const COIN_DATA = {
  USDC: {
    mint: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
    decimals: 6,
  },
};

export class GenerateSolanaTransaction {
  public generateUsdcTransaction(
    feePayerKey: string,
    recipientKey: string,
    usdcAmount: number,
    numberOfTransfers: number = 1,
  ): string {
    return this.generateSplTokenTransaction(
      feePayerKey,
      recipientKey,
      COIN_DATA.USDC.mint.toBase58(),
      usdcAmount,
      COIN_DATA.USDC.decimals,
      numberOfTransfers,
    );
  }

  public generateSplTokenTransaction(
    feePayerKey: string,
    recipientKey: string,
    mintAddress: string,
    amountInTokens: number,
    decimals: number,
    numberOfTransfers: number = 1,
  ): string {
    const feePayer = new PublicKey(feePayerKey);
    const recipient = new PublicKey(recipientKey);
    const mint = new PublicKey(mintAddress);

    const sourceATA = getAssociatedTokenAddressSync(
      mint,
      feePayer,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    const destATA = getAssociatedTokenAddressSync(
      mint,
      recipient,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    const amount = BigInt(Math.round(amountInTokens * 10 ** decimals));

    const tx = new Transaction({
      // hardcoded as transaction won't be broadcasted but only used for testing
      recentBlockhash: "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg",
      feePayer,
    });
    for (let i = 0; i < numberOfTransfers; i++) {
      tx.add(
        createTransferCheckedInstruction(
          sourceATA,
          mint,
          destATA,
          feePayer,
          amount,
          decimals,
          [],
        ),
      );
    }

    tx.signatures = [{ publicKey: feePayer, signature: null }];

    return this.toBase64(tx.serializeMessage());
  }

  public generatePlainSolanaTransaction(
    feePayerKey: string,
    recipientKey: string,
    lamports: number,
    numberOfTransactions: number = 1,
  ): string {
    const feePayer = new PublicKey(feePayerKey);
    const recipient = new PublicKey(recipientKey);

    const tx = new Transaction({
      // hardcoded as transaction won't be broadcasted but only used for testing
      recentBlockhash: "a3PD566oU2nE9JHwuC897aaT7ispdqaQ63Si6jzyKAg",
      feePayer,
    });
    for (let i = 0; i < numberOfTransactions; i++) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: feePayer,
          toPubkey: recipient,
          lamports,
        }),
      );
    }
    tx.signatures = [{ publicKey: feePayer, signature: null }];
    return this.toBase64(tx.serializeMessage());
  }

  private toBase64(bytes: Uint8Array): string {
    let bin = "";
    for (const b of bytes) {
      if (typeof b !== "number") throw new Error("Invalid byte value");
      bin += String.fromCharCode(b);
    }
    try {
      return btoa(bin);
    } catch {
      return Buffer.from(bytes).toString("base64");
    }
  }
}
