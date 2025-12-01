export type TransactionResolutionContext = {
  tokenAddress?: string;
  createATA?: {
    address: string;
    mintAddress: string;
  };
  tokenInternalId?: string;
  templateId?: string;
  userInputType?: UserInputType;
};

export enum UserInputType {
  sol,
  ata,
}
