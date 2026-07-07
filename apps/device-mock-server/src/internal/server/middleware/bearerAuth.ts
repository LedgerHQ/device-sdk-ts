import { type NextFunction, type Request, type Response } from "express";

import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { type SessionRecord } from "@internal/session/model/SessionModels";

/** An Express request whose session has been resolved by {@link bearerAuth}. */
export interface AuthedRequest extends Request {
  session?: SessionRecord;
}

const BEARER_PREFIX = "Bearer ";

/**
 * Resolve the session from the `Authorization: Bearer <token>` header and attach
 * it to the request. Responds 401 when the token is missing, unknown or expired.
 */
export function bearerAuth(repository: SessionRepository) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    const header = req.header("authorization") ?? "";
    if (!header.startsWith(BEARER_PREFIX)) {
      res.status(401).json({ error: "Missing bearer token" });
      return;
    }
    const token = header.slice(BEARER_PREFIX.length).trim();
    const record = repository.findByToken(token).extract();
    if (!record) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    req.session = record;
    next();
  };
}

/** Narrow a request to its resolved session (set by {@link bearerAuth}). */
export function getSession(req: AuthedRequest): SessionRecord {
  if (!req.session) {
    throw new Error("Session not resolved; bearerAuth middleware missing");
  }
  return req.session;
}
