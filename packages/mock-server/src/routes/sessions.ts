import { type Response, Router } from "express";

import { logger } from "../logger";
import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "../middleware/bearerAuth";
import { type SessionStore } from "../store/SessionStore";

/** Routes for the current session resource (resolved from the bearer token). */
export function sessionsRouter(store: SessionStore): Router {
  const router = Router();
  router.use(bearerAuth(store));

  router.get("/sessions/current", (req: AuthedRequest, res: Response) => {
    res.json(store.toSession(getSession(req)));
  });

  router.delete("/sessions/current", (req: AuthedRequest, res: Response) => {
    store.deleteSession(getSession(req).token);
    logger.info(`Session disposed (${store.size()} active)`);
    res.status(204).end();
  });

  return router;
}
