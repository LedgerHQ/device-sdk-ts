import { type Either } from "purify-ts";

export type AccountOwnershipNetwork = "mainnet" | "testnet";

export type GetAccountOwnershipParams = {
  publicKey: string;
  address: string;
  challenge: string;
  network: AccountOwnershipNetwork;
};

export type AccountOwnershipDescriptor = {
  signedDescriptor: string;
  keyId: string;
  keyUsage: string;
};

export interface AccountOwnershipDataSource {
  getDescriptor(
    params: GetAccountOwnershipParams,
  ): Promise<Either<Error, AccountOwnershipDescriptor>>;
}
