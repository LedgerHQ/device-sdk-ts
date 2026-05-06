import { type DeviceModelId } from "@ledgerhq/device-management-kit";

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
