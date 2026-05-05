import { type Either } from "purify-ts";

export type ConcordiumAccountOwnershipNetwork = "mainnet" | "testnet";

export type ConcordiumGetAccountOwnershipParams = {
  publicKey: string;
  address: string;
  challenge: string;
  network: ConcordiumAccountOwnershipNetwork;
};

export type ConcordiumAccountOwnershipDescriptor = {
  signedDescriptor: string;
  keyId: string;
  keyUsage: string;
};

export interface ConcordiumAccountOwnershipDataSource {
  getDescriptor(
    params: ConcordiumGetAccountOwnershipParams,
  ): Promise<Either<Error, ConcordiumAccountOwnershipDescriptor>>;
}
