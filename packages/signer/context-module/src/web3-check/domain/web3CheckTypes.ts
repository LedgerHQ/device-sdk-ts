import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { type PkiCertificate } from "@/pki/model/PkiCertificate";

export type Web3CheckContext = {
  from: string;
  rawTx: string;
  chainId: number;
  deviceModelId: DeviceModelId;
};

export type Web3Checks = {
  publicKeyId: string;
  descriptor: string;
  certificate?: PkiCertificate;
};
