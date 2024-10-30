import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DeviceSession } from "@internal/device-session/model/DeviceSession";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

@injectable()
export class DefaultDeviceSessionService implements DeviceSessionService {
  private _sessions: DeviceSession[];
  private _logger: LoggerPublisherService;

  constructor(
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessions = [];
    this._logger = loggerModuleFactory("DeviceSessionService");
  }

  addDeviceSession(deviceSession: DeviceSession) {
    const found = this._sessions.find((s) => s.id === deviceSession.id);
    if (found) {
      this._logger.warn("DeviceSession already exists", {
        data: { deviceSession },
      });
      return this;
    }

    this._sessions.push(deviceSession);
    this._logger.info("DeviceSession added", { data: { deviceSession } });
    return this;
  }

  removeDeviceSession(sessionId: string) {
    const found = this._sessions.find((s) => s.id === sessionId);
    if (found) {
      found.close();
      this._sessions = this._sessions.filter((s) => s.id !== sessionId);
      this._logger.info("DeviceSession removed", { data: { sessionId } });
      return this;
    }

    this._logger.warn("DeviceSession not found", { data: { sessionId } });
    return this;
  }

  getDeviceSessionById(sessionId: string) {
    const deviceSession = Maybe.fromNullable(
      this._sessions.find((s) => s.id === sessionId),
    );

    return deviceSession.toEither(new DeviceSessionNotFound());
  }

  getDeviceSessionByDeviceId(deviceId: string) {
    const deviceSession = Maybe.fromNullable(
      this._sessions.find((s) => s.connectedDevice.id === deviceId),
    );

    return deviceSession.toEither(new DeviceSessionNotFound());
  }

  getDeviceSessions() {
    return this._sessions;
  }
}
