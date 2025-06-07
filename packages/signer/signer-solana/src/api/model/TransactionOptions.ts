import { type DeviceModelId } from "@ledgerhq/device-management-kit";

export type TransactionOptions = {
  skipOpenApp?: boolean;
  deviceModelId?: DeviceModelId;
  tokenAddress?: string;
  createATA?: {
    address: string;
    mintAddress: string;
  };
};
