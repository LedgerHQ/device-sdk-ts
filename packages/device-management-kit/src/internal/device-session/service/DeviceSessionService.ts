import { type Either } from "purify-ts";
import { type Observable } from "rxjs";

import { type DmkError } from "@api/Error";
import { type DeviceId } from "@api/types";
import { type DeviceSession } from "@internal/device-session/model/DeviceSession";

export interface DeviceSessionService {
  /**
   * Add a device session.
   * @param deviceSession The device session to add.
   */
  addDeviceSession(deviceSession: DeviceSession): DeviceSessionService;

  /**
   * Get a device session by its ID.
   * @param sessionId The ID of the session to retrieve.
   * @returns The device session or an error if not found.
   */
  getDeviceSessionById(sessionId: string): Either<DmkError, DeviceSession>;

  /**
   * Get device sessions by device ID.
   * @param deviceId The ID of the device.
   * @returns The device sessions of the device or an error if not found.
   */
  getDeviceSessionsByDeviceId(
    deviceId: DeviceId,
  ): Either<DmkError, DeviceSession[]>;

  /**
   * Remove a device session by its ID.
   * @param sessionId The ID of the session to remove.
   */
  removeDeviceSession(sessionId: string): DeviceSessionService;

  /**
   * Get all device sessions.
   * @returns An array of device sessions.
   */
  getDeviceSessions(): DeviceSession[];

  /**
   * Get an observable of device sessions.
   * @returns An observable of device sessions.
   */
  get sessionsObs(): Observable<DeviceSession>;
}
