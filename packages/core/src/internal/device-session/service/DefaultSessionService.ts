import { inject, injectable } from "inversify";
import { Maybe } from "purify-ts";

import { DeviceSessionNotFound } from "@internal/device-session/model/Errors";
import { Session } from "@internal/device-session/model/Session";
import { SessionService } from "@internal/device-session/service/SessionService";
import { loggerTypes } from "@internal/logger-publisher/di/loggerTypes";
import { LoggerPublisherService } from "@internal/logger-publisher/service/LoggerPublisherService";

@injectable()
export class DefaultSessionService implements SessionService {
  private _sessions: Session[];
  private _logger: LoggerPublisherService;

  constructor(
    @inject(loggerTypes.LoggerPublisherServiceFactory)
    loggerModuleFactory: (tag: string) => LoggerPublisherService,
  ) {
    this._sessions = [];
    this._logger = loggerModuleFactory("session");
  }

  addSession(session: Session) {
    const found = this._sessions.find((s) => s.id === session.id);
    if (found) {
      this._logger.warn("Session already exists", { data: { session } });
      return this;
    }

    this._sessions.push(session);
    this._logger.info("Session added", { data: { session } });
    return this;
  }

  removeSession(sessionId: string) {
    const found = this._sessions.find((s) => s.id === sessionId);
    if (found) {
      this._sessions = this._sessions.filter((s) => s.id !== sessionId);
      this._logger.info("Session removed", { data: { sessionId } });
      return this;
    }

    this._logger.warn("Session not found", { data: { sessionId } });
    return this;
  }

  getSession(sessionId: string) {
    const session = Maybe.fromNullable(
      this._sessions.find((s) => s.id === sessionId),
    );

    return session.toEither(new DeviceSessionNotFound());
  }

  getSessions() {
    return this._sessions;
  }
}
