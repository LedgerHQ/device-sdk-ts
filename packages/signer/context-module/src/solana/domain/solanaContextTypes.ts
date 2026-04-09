import { type DeviceModelId } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import type { SolanaTransactionScanChainId } from "@/shared/model/Web3ChecksTypes";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import {
  type SolanaLifiContextResult,
  type SolanaTokenContextResult,
  type SolanaTransactionCheckContextResult,
} from "@/shared/model/SolanaContextTypes";

export type SolanaTransactionCheckFields = {
  from: string;
  rawTx: string;
  chain?: SolanaTransactionScanChainId;
  domain?: string;
  block?: number;
};

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
  // When present with `from` and `rawTx`, loads Web3Checks transaction-check context.
  transactionCheck?: SolanaTransactionCheckFields;
};

export type SolanaSPLOwnerInfo = {
  tokenAccount: string;
  owner: string;
  contract: string;
  signedDescriptor: string;
};

export type SolanaContextLoaderResults = Array<
  | SolanaTokenContextResult
  | SolanaLifiContextResult
  | SolanaTransactionCheckContextResult
>;

export type SolanaTransactionContextResultSuccess = {
  trustedNamePKICertificate?: PkiCertificate;
  tlvDescriptor?: Uint8Array;
  loadersResults: SolanaContextLoaderResults;
};

export type SolanaTransactionContextResult = Either<
  Error,
  SolanaTransactionContextResultSuccess
>;
