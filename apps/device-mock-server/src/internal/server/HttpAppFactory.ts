import express, { type Express, type Request, type Response } from "express";
import { inject, injectable } from "inversify";

import { serverTypes } from "@internal/server/di/serverTypes";
import { requestLogger } from "@internal/server/middleware/requestLogger";
import { type AuthRoutes } from "@internal/server/routes/AuthRoutes";
import { type DeviceRoutes } from "@internal/server/routes/DeviceRoutes";
import { type SessionsRoutes } from "@internal/server/routes/SessionsRoutes";
import { type TransferRoutes } from "@internal/server/routes/TransferRoutes";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";

/** Composes the injected route builders into the Express application. */
@injectable()
export class HttpAppFactory {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
    @inject(serverTypes.AuthRoutes) private readonly auth: AuthRoutes,
    @inject(serverTypes.SessionsRoutes)
    private readonly sessions: SessionsRoutes,
    @inject(serverTypes.DeviceRoutes) private readonly devices: DeviceRoutes,
    @inject(serverTypes.TransferRoutes)
    private readonly transfer: TransferRoutes,
  ) {}

  build(): Express {
    const app = express();

    app.use(requestLogger());
    app.use(express.json());

    // CORS: this is a local development/test server consumed from browser apps.
    app.use((req, res, next) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PATCH, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      next();
    });

    /**
     * @openapi
     * /health:
     *   get:
     *     tags: [Health]
     *     summary: Liveness probe
     *     security: []
     *     responses:
     *       200:
     *         description: Server is up.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/Health'
     */
    app.get("/health", (_req: Request, res: Response) => {
      res.json({ status: "ok", sessions: this.repository.size() });
    });

    app.use(this.auth.build());
    app.use(this.sessions.build());
    app.use(this.devices.build());
    app.use(this.transfer.build());

    return app;
  }
}
