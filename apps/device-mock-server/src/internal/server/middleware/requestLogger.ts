import { type NextFunction, type Request, type Response } from "express";

import { logger } from "@internal/logger/logger";
import { runWithRequestContext } from "@internal/logger/requestContext";

const BEARER_PREFIX = "Bearer ";

/**
 * Logs every HTTP request once the response is sent, including method, path,
 * status code and duration. Establishes the per-request context so the session
 * tag is prefixed on this and every downstream log line. Registered first so it
 * captures all routes.
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    const header = req.header("authorization") ?? "";
    const sessionToken = header.startsWith(BEARER_PREFIX)
      ? header.slice(BEARER_PREFIX.length).trim()
      : undefined;
    res.on("finish", () => {
      const durationMs = Date.now() - start;
      runWithRequestContext({ sessionToken }, () => {
        logger.info(
          `${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`,
        );
      });
    });
    runWithRequestContext({ sessionToken }, next);
  };
}
