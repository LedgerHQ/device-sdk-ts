import { type Either } from "purify-ts";

import { type SdkError } from "@api/Error";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";

export interface DeviceSessionService {
  addDeviceSession(deviceSession: DeviceSession): DeviceSessionService;
  getDeviceSessionById(sessionId: string): Either<SdkError, DeviceSession>;
  getDeviceSessionByDeviceId(deviceId: string): Either<SdkError, DeviceSession>;
  removeDeviceSession(sessionId: string): DeviceSessionService;
  getDeviceSessions(): DeviceSession[];
}
