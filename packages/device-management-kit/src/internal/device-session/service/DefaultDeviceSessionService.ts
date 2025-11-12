import { inject, injectable } from "inversify";
import { Either, Maybe } from "purify-ts";
import { Observable, ReplaySubject } from "rxjs";

import { LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { DeviceId } from "@api/types";
import { DeviceSession } from "@internal/device-session/model/DeviceSession";
import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { DeviceSessionService } from "@internal/device-session/service/DeviceSessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";

@injectable()
export class DefaultDeviceSessionService implements DeviceSessionService {
  private _sessions: DeviceSession[];
  private readonly _sessionsSubject: ReplaySubject<DeviceSession>;
  private readonly _logger: LoggerPublisherService;

  constructor(
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessions = [];
    this._sessionsSubject = new ReplaySubject();
    this._logger = loggerModuleFactory("DeviceSessionService");
  }

  public get sessionsObs(): Observable<DeviceSession> {
    return this._sessionsSubject.asObservable();
  }

  addDeviceSession(deviceSession: DeviceSession): DeviceSessionService {
    const found = this._sessions.find((s) => s.id === deviceSession.id);
    if (found) {
      this._logger.warn("DeviceSession already exists", {
        data: { deviceSession },
      });
      return this;
    }
    this._sessions.push(deviceSession);
    this._sessionsSubject.next(deviceSession);
    this._logger.info("DeviceSession added", {
      data: { sessionId: deviceSession.id },
    });
    return this;
  }

  removeDeviceSession(sessionId: string): DeviceSessionService {
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

  getDeviceSessionById(
    sessionId: string,
  ): Either<DeviceSessionNotFound, DeviceSession> {
    return Maybe.fromNullable(
      this._sessions.find((s) => s.id === sessionId),
    ).toEither(new DeviceSessionNotFound());
  }

  getDeviceSessionsByDeviceId(
    deviceId: DeviceId,
  ): Either<DeviceSessionNotFound, DeviceSession[]> {
    return Maybe.fromPredicate(
      ({ length }) => length > 0,
      this._sessions.filter((s) => s.connectedDevice.id === deviceId),
    ).toEither(new DeviceSessionNotFound());
  }

  getDeviceSessions(): DeviceSession[] {
    return this._sessions;
  }
}
