import { type DeviceModelId } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { type SolanaLifiContextResult } from "@/solanaLifi/domain/SolanaLifiContext";
import { type SolanaTokenContextResult } from "@/solanaToken/domain/SolanaTokenContext";

export type SolanaTransactionContext = {
  deviceModelId: DeviceModelId;
  challenge?: string;
  tokenAddress?: string;
  tokenInternalId?: string;
  templateId?: string;
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

export type SolanaContextLoaderResults = Array<
  SolanaTokenContextResult | SolanaLifiContextResult
>;

export type SolanaTransactionContextResultSuccess = {
  trustedNamePKICertificate: PkiCertificate;
  tlvDescriptor: Uint8Array;
  loadersResults: SolanaContextLoaderResults;
};

export type SolanaTransactionContextResult = Either<
  Error,
  SolanaTransactionContextResultSuccess
>;
