export type TransactionResolutionContext = {
  tokenAddress?: string;
  createATA?: {
    address: string;
    mintAddress: string;
  };
  userInputType?: UserInputType;
};

export enum UserInputType {
  sol,
  ata,
}
