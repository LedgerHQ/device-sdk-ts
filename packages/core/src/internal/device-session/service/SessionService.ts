import { Either } from "purify-ts";

import { SdkError } from "@api/Error";
import { Session } from "@internal/device-session/model/Session";

export interface SessionService {
  addSession(session: Session): SessionService;
  getSession(sessionId: string): Either<SdkError, Session>;
  removeSession(sessionId: string): SessionService;
  getSessions(): Session[];
}
