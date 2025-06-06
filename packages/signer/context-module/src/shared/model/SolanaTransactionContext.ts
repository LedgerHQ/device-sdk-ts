import { type DeviceModelId } from "@ledgerhq/device-management-kit";

export type SolanaTransactionContext = {
  challenge: string | undefined;
  deviceModelId: DeviceModelId;
  tokenAddress?: string;
  createATA?: {
    address: string;
    mintAddress: string;
  };
};
