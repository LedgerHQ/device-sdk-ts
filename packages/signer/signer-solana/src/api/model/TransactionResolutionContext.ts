export type TransactionResolutionContext = {
  tokenAddress?: string;
  mintAddress?: string;
  tokenInternalId?: string;
  createATA?: {
    address: string;
    mintAddress: string;
  };
  templateId?: string;
  userInputType?: UserInputType;
};

export enum UserInputType {
  SOL = "sol",
  ATA = "ata",
}
