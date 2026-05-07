import { type DeviceModelId } from "@ledgerhq/device-management-kit";

import { type ContextLoader } from "@/shared/domain/ContextLoader";

export type TransactionCheckInput = {
  from: string;
  deviceModelId: DeviceModelId;
};

export type TransactionCheckLoader<TInput extends TransactionCheckInput> =
  ContextLoader<TInput>;
