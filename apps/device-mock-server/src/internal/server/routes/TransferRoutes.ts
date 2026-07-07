import { type Response, Router } from "express";
import { inject, injectable } from "inversify";

import { logger } from "@internal/logger/logger";
import {
  type AuthedRequest,
  bearerAuth,
  getSession,
} from "@internal/server/middleware/bearerAuth";
import { decodeSessionImport } from "@internal/server/validation/requests";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";

/**
 * Session-scoped import/export of the devices snapshot (each device carrying its
 * own mocks), so complex scenarios can be saved and restored.
 */
@injectable()
export class TransferRoutes {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
  ) {}

  build(): Router {
    const router = Router();
    router.use(bearerAuth(this.repository));

    /**
     * @openapi
     * /export:
     *   get:
     *     tags: [Transfer]
     *     summary: Export the session's devices and mocks
     *     responses:
     *       200:
     *         description: A portable snapshot of the session.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SessionExport'
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     */
    router.get("/export", (req: AuthedRequest, res: Response) => {
      res.json(this.repository.exportSession(getSession(req)));
    });

    /**
     * @openapi
     * /import:
     *   post:
     *     tags: [Transfer]
     *     summary: Replace the session's devices and mocks with a snapshot
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             $ref: '#/components/schemas/SessionExport'
     *     responses:
     *       200:
     *         description: The resulting (normalized) snapshot.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/SessionExport'
     *       400:
     *         description: Malformed snapshot.
     *       401:
     *         $ref: '#/components/responses/Unauthorized'
     */
    router.post("/import", (req: AuthedRequest, res: Response) => {
      decodeSessionImport(req.body).caseOf({
        Left: (error) => res.status(400).json({ error }),
        Right: (snapshot) => {
          const result = this.repository.importSession(
            getSession(req),
            snapshot,
          );
          const mockCount = result.devices.reduce(
            (total, device) => total + (device.mocks?.length ?? 0),
            0,
          );
          logger.info(
            `Session imported: ${result.devices.length} device(s), ${mockCount} mock(s)`,
          );
          return res.json(result);
        },
      });
    });

    return router;
  }
}
