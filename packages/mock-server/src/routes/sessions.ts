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

  /**
   * @openapi
   * /sessions/current:
   *   get:
   *     tags: [Sessions]
   *     summary: Get the current session
   *     responses:
   *       200:
   *         description: The session resolved from the bearer token.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Session'
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   *   delete:
   *     tags: [Sessions]
   *     summary: Dispose the current session
   *     responses:
   *       204:
   *         description: Session disposed.
   *       401:
   *         $ref: '#/components/responses/Unauthorized'
   */
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
