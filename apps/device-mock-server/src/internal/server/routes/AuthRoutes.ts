import { type Request, type Response, Router } from "express";
import { inject, injectable } from "inversify";

import { logger } from "@internal/logger/logger";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";

/** POST /auth — create a session and return a bearer token. */
@injectable()
export class AuthRoutes {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
  ) {}

  build(): Router {
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
      const { token, expiresAt } = this.repository.createSession();
      logger.info(
        `Session created: ${token} (${this.repository.size()} active)`,
      );
      res.status(201).json({ token, expires_at: expiresAt });
    });

    return router;
  }
}
