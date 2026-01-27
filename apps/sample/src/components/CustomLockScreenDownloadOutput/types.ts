import { type DeviceModelId } from "@ledgerhq/device-management-kit";
import { type DownloadCustomLockScreenDAOutput } from "@ledgerhq/dmk-ledger-wallet";

export type DownloadOutputProps = {
  deviceModelId: DeviceModelId;
  output: DownloadCustomLockScreenDAOutput;
};
