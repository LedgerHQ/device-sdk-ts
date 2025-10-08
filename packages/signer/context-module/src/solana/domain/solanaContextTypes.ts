import { type DeviceModelId } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type PkiCertificate } from "@/pki/model/PkiCertificate";

export type SolanaTransactionContext = {
  deviceModelId: DeviceModelId;
  challenge?: string;
  tokenAddress?: string;
  createATA?: {
    address: string;
    mintAddress: string;
  };
};

export type SolanaSPLOwnerInfo = {
  tokenAccount: string;
  owner: string;
  contract: string;
  signedDescriptor: string;
};

export type SolanaTransactionContextResultSuccess = {
  descriptor: Uint8Array;
  tokenAccount: string;
  owner: string;
  contract: string;
  certificate: PkiCertificate;
};

export type SolanaTransactionContextResult = Either<
  Error,
  SolanaTransactionContextResultSuccess
>;
