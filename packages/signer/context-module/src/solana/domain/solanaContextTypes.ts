import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { type PkiCertificate } from "@/pki/model/PkiCertificate";

export type SolanaTransactionContext = {
  challenge: string | undefined;
  deviceModelId: DeviceModelId;
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

export type SolanaTransactionContextResult = {
  descriptor: Uint8Array;
  certificate: PkiCertificate;
  tokenAccount: string;
  owner: string;
  contract: string;
};
