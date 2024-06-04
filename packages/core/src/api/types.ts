import type { DeviceId } from "@api/device/DeviceModel";
import type { DeviceSessionId } from "@api/device-session/types";

export type { DeviceId } from "./device/DeviceModel";
export type { ConnectionType } from "./discovery/ConnectionType";
export type { DiscoveredDevice } from "./discovery/DiscoveredDevice";
export type { LogSubscriberOptions } from "./logger-subscriber/model/LogSubscriberOptions";
export type { DeviceModelId } from "@api/device/DeviceModel";
export type { DeviceSessionId } from "@api/device-session/types";

export type ConnectUseCaseArgs = {
  /**
   * UUID of the device got from device discovery `StartDiscoveringUseCase`
   */
  deviceId: DeviceId;
};

/**
 * The arguments for the DisconnectUseCase.
 */
export type DisconnectUseCaseArgs = {
  sessionId: DeviceSessionId;
};

export type SendApduUseCaseArgs = {
  /**
   * Device session identifier from `DeviceSdk.connect`.
   */
  sessionId: DeviceSessionId;
  /**
   * Raw APDU to send to the device.
   */
  apdu: Uint8Array;
};
