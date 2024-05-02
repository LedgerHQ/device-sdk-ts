import { DeviceStatus } from "@api/device/DeviceStatus";
import { DeviceSessionId } from "@api/device-session/types";

export type SessionStateConstructorArgs = {
  sessionId: DeviceSessionId;
  deviceStatus: DeviceStatus;
};

export class DeviceSessionState {
  public readonly sessionId: DeviceSessionId;
  public readonly deviceStatus: DeviceStatus;

  constructor({ sessionId, deviceStatus }: SessionStateConstructorArgs) {
    this.sessionId = sessionId;
    this.deviceStatus = deviceStatus;
  }
}
