import { type NextFunction, type Request, type Response } from "express";

import { logger } from "../logger";

/**
 * Logs every HTTP request once the response is sent, including method, path,
 * status code and duration. Registered first so it captures all routes.
 */
export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - start;
      logger.info(
        `${req.method} ${req.originalUrl} -> ${res.statusCode} (${durationMs}ms)`,
      );
    });
    next();
  };
}
