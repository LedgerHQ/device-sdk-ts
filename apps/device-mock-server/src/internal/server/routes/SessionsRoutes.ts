import { type Response, Router } from "express";
import { inject, injectable, optional } from "inversify";

import { logger } from "@internal/logger/logger";
import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "@internal/server/middleware/bearerAuth";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import { type SpeculosOperatorDataSource } from "@internal/speculos/data/SpeculosOperatorDataSource";
import { speculosTypes } from "@internal/speculos/di/speculosTypes";

/** Routes for the current session resource (resolved from the bearer token). */
@injectable()
export class SessionsRoutes {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
    @optional()
    @inject(speculosTypes.OperatorDataSource)
    private readonly operator?: SpeculosOperatorDataSource,
  ) {}

  build(): Router {
    const router = Router();
    router.use(bearerAuth(this.repository));

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
      res.json(this.repository.toSession(getSession(req)));
    });

    router.delete("/sessions/current", (req: AuthedRequest, res: Response) => {
      const evicted = this.repository.deleteSession(getSession(req).token);
      for (const proxy of evicted)
        void this.operator?.release(proxy.runId).run();
      logger.info(`Session disposed (${this.repository.size()} active)`);
      res.status(204).end();
    });

    return router;
  }
}
