import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";

export type ComputeATAArgs = {
  // User’s wallet pubkey (base58)
  ownerAddress: string;
  // SPL token mint address (base58)
  mintAddress: string;
};

/**
 * helper to derive the Associated Token Account
 * PDA for a given owner + mint.
 */
export class ComputeAssociatedTokenAccountAddress {
  /**
   * @param args.ownerAddress  base58 owner/pubkey
   * @param args.mintAddress   base58 token mint
   * @returns the ATA address as a base58 string
   */
  async run(args: ComputeATAArgs): Promise<string> {
    const ownerPk = new PublicKey(args.ownerAddress);
    const mintPk = new PublicKey(args.mintAddress);

    const ata = await getAssociatedTokenAddress(
      mintPk,
      ownerPk,
      false, // allowOwnerOffCurve
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );

    return ata.toBase58();
  }
}
