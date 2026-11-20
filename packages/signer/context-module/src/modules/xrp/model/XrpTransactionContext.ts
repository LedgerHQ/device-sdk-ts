import { type DeviceModelId } from "@ledgerhq/device-management-kit";

export type XrpTransactionContext = {
  /** Hex issuance IDs of the MPTs the transaction uses (24 bytes each). */
  mptIssuanceIds: string[];
  deviceModelId: DeviceModelId;
};
