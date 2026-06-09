import express, { type Express, type Request, type Response } from "express";

import { requestLogger } from "./middleware/requestLogger";
import { authRouter } from "./routes/auth";
import { devicesRouter } from "./routes/devices";
import { mocksRouter } from "./routes/mocks";
import { sessionsRouter } from "./routes/sessions";
import { SessionStore, type SessionStoreOptions } from "./store/SessionStore";
import { logger } from "./logger";

export interface MockServerOptions extends SessionStoreOptions {
  /** Interval in ms for the expired-session sweeper. Set to 0 to disable. */
  readonly sweepIntervalMs?: number;
}

export interface MockServerApp {
  readonly app: Express;
  readonly store: SessionStore;
  /** Stop the background sweeper. */
  readonly close: () => void;
}

const DEFAULT_SWEEP_INTERVAL_MS = 60 * 1000;

/**
 * Build the Express application implementing the device mock server contract
 * (ADR 001 / ADR 002 Solution 3). Exported separately from {@link main} so it
 * can be exercised in tests without binding a port.
 */
export function createMockServer(
  options: MockServerOptions = {},
): MockServerApp {
  const store = new SessionStore(options);
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

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", sessions: store.size() });
  });

  app.use(authRouter(store));
  app.use(sessionsRouter(store));
  app.use(devicesRouter(store));
  app.use(mocksRouter(store));

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
