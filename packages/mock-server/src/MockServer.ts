import express, { type Express, type Request, type Response } from "express";

import { requestLogger } from "./middleware/requestLogger";
import { authRouter } from "./routes/auth";
import { devicesRouter } from "./routes/devices";
import { mocksRouter } from "./routes/mocks";
import { sessionsRouter } from "./routes/sessions";
import { transferRouter } from "./routes/transfer";
import {
  SpeculinhoClient,
  type SpeculinhoClientOptions,
} from "./speculos/SpeculinhoClient";
import { SessionStore, type SessionStoreOptions } from "./store/SessionStore";
import { logger } from "./logger";

export interface MockServerOptions extends SessionStoreOptions {
  /** Interval in ms for the expired-session sweeper. Set to 0 to disable. */
  readonly sweepIntervalMs?: number;
  /**
   * Speculinho operator configuration. When set, an unmatched Open App APDU
   * starts a real Speculos instance and the device proxies APDUs to it. When
   * omitted, the server behaves as a pure mock.
   */
  readonly speculos?: SpeculinhoClientOptions;
}

export interface MockServerApp {
  readonly app: Express;
  readonly store: SessionStore;
  /** Stop the background sweeper. */
  readonly close: () => void;
}

const DEFAULT_SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Build the Express application implementing the device mock server contract.
 * Exported separately from {@link main} so it
 * can be exercised in tests without binding a port.
 */
export function createMockServer(
  options: MockServerOptions = {},
): MockServerApp {
  const store = new SessionStore(options);
  const client = options.speculos
    ? new SpeculinhoClient(options.speculos)
    : undefined;
  if (client) {
    // Release Speculos instances backing evicted sessions/devices.
    store.onEvict = (sessions) => {
      for (const proxy of sessions) void client.release(proxy.runId);
    };
  }
  const app = express();

  app.use(requestLogger());
  app.use(express.json());

  // CORS: this is a local development/test server consumed from browser apps.
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (_req.method === "OPTIONS") {
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
    res.json({ status: "ok", sessions: store.size() });
  });

  app.use(authRouter(store));
  app.use(sessionsRouter(store));
  app.use(devicesRouter(store, client));
  app.use(mocksRouter(store));
  app.use(transferRouter(store));

  const sweepInterval = options.sweepIntervalMs ?? DEFAULT_SWEEP_INTERVAL_MS;
  const timer =
    sweepInterval > 0
      ? setInterval(() => {
          const removed = store.sweep();
          if (removed > 0) {
            logger.debug(
              `Swept ${removed} expired session(s) (${store.size()} active)`,
            );
          }
        }, sweepInterval)
      : undefined;
  timer?.unref?.();

  return {
    app,
    store,
    close: () => {
      if (timer) clearInterval(timer);
    },
  };
}
