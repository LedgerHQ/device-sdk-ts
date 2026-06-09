import { type Request, type Response, Router } from "express";

import { logger } from "../logger";
import { type SessionStore } from "../store/SessionStore";

/**
 * POST /auth — create a session and return a bearer token.
 */
export function authRouter(store: SessionStore): Router {
  const router = Router();

  /**
   * @openapi
   * /auth:
   *   post:
   *     tags: [Auth]
   *     summary: Create a session
   *     description: Creates an in-memory session and returns its bearer token.
   *     security: []
   *     responses:
   *       201:
   *         description: Session created.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   */
  router.post("/auth", (_req: Request, res: Response) => {
    const { token, expiresAt } = store.createSession();
    logger.info(`Session created: ${token} (${store.size()} active)`);
    res.status(201).json({ token, expires_at: expiresAt });
  });

  return router;
}
