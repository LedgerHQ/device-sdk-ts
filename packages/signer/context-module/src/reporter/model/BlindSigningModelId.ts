import { DeviceModelId } from "@ledgerhq/device-management-kit";

export const BlindSigningModelId = Object.freeze({
  NANO_S: "nanoS",
  NANO_SP: "nanoSP",
  NANO_X: "nanoX",
  STAX: "stax",
  FLEX: "flex",
  APEX_P: "apexP",
} as const);
export type BlindSigningModelId =
  (typeof BlindSigningModelId)[keyof typeof BlindSigningModelId];

const deviceModelIdToBlindSigningModelId: Record<
  DeviceModelId,
  BlindSigningModelId
> = {
  [DeviceModelId.NANO_S]: BlindSigningModelId.NANO_S,
  [DeviceModelId.NANO_SP]: BlindSigningModelId.NANO_SP,
  [DeviceModelId.NANO_X]: BlindSigningModelId.NANO_X,
  [DeviceModelId.STAX]: BlindSigningModelId.STAX,
  [DeviceModelId.FLEX]: BlindSigningModelId.FLEX,
  [DeviceModelId.APEX]: BlindSigningModelId.APEX_P,
};

export function mapDeviceModelId(id: DeviceModelId): BlindSigningModelId {
  return deviceModelIdToBlindSigningModelId[id];
}
