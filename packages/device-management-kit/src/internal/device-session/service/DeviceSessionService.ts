import { type Either } from "purify-ts";

import { type DmkError } from "@api/Error";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";

export interface DeviceSessionService {
  addDeviceSession(deviceSession: DeviceSession): DeviceSessionService;
  getDeviceSessionById(sessionId: string): Either<DmkError, DeviceSession>;
  getDeviceSessionByDeviceId(deviceId: string): Either<DmkError, DeviceSession>;
  removeDeviceSession(sessionId: string): DeviceSessionService;
  getDeviceSessions(): DeviceSession[];
}
