import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { type ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type TransactionSubset } from "@/shared/model/TransactionSubset";

export type TransactionFieldContext =
  | {
      type: ClearSignContextType.TOKEN | ClearSignContextType.NFT;
      chainId: number;
      address: string;
    }
  | {
      type: ClearSignContextType.TRUSTED_NAME;
      chainId: number;
      address: string;
      challenge: string;
      types: string[];
      sources: string[];
    };

export type TransactionContext = TransactionSubset & {
  challenge?: string;
  domain?: string;
  deviceModelId?: DeviceModelId;
};
