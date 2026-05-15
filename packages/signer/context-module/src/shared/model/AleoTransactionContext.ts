import { type DeviceModelId } from "@ledgerhq/device-management-kit";

export type AleoTransactionContext = {
  tokenInternalId: string;
  programName?: string;
  deviceModelId: DeviceModelId;
};
