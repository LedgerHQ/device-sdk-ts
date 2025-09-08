import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { type TransactionSubset } from "@/shared/model/TransactionSubset";

export type TransactionContext = TransactionSubset & {
  deviceModelId: DeviceModelId; // needed to fetch the correct certificate
  challenge?: string;
  domain?: string;
};
