import { DeviceStatus } from "@api/device/DeviceStatus";
import { SessionId } from "@api/session/types";

export type SessionStateConstructorArgs = {
  sessionId: SessionId;
  deviceStatus: DeviceStatus;
};

export class SessionDeviceState {
  public readonly sessionId: SessionId;
  public readonly deviceStatus: DeviceStatus;

  constructor({ sessionId, deviceStatus }: SessionStateConstructorArgs) {
    this.sessionId = sessionId;
    this.deviceStatus = deviceStatus;
  }
}
