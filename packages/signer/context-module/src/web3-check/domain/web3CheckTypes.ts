import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { type PkiCertificate } from "@/pki/model/PkiCertificate";

export type Web3CheckTypedData = {
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
    salt?: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type Web3CheckTypedDataContext = {
  from: string;
  deviceModelId: DeviceModelId;
  data: Web3CheckTypedData;
};

export type Web3CheckRawTxContext = {
  from: string;
  deviceModelId: DeviceModelId;
  rawTx: string;
  chainId: number;
};

export type Web3CheckContext =
  | Web3CheckTypedDataContext
  | Web3CheckRawTxContext;

export type Web3Checks = {
  publicKeyId: string;
  descriptor: string;
  certificate?: PkiCertificate;
};
