import { type Either } from "purify-ts";

export type AccountOwnershipNetwork = "mainnet" | "testnet";

export type ConcordiumGetAccountOwnershipParams = {
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
    params: ConcordiumGetAccountOwnershipParams,
  ): Promise<Either<Error, AccountOwnershipDescriptor>>;
}
