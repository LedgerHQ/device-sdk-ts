import { Either } from "purify-ts";

import { SdkError } from "@api/Error";
import { DeviceSession } from "@internal/device-session/model/DeviceSession";

export interface DeviceSessionService {
  addDeviceSession(deviceSession: DeviceSession): DeviceSessionService;
  getDeviceSessionById(sessionId: string): Either<SdkError, DeviceSession>;
  getDeviceSessionByDeviceId(deviceId: string): Either<SdkError, DeviceSession>;
  removeDeviceSession(sessionId: string): DeviceSessionService;
  getDeviceSessions(): DeviceSession[];
}
