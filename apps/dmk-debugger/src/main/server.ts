import express, { type Express } from "express";
import type { Server } from "http";
import { mountMcpServer } from "./mcp";
import type { LogStore } from "./store";

export interface ServerOptions {
  port: number;
  store: LogStore;
  onReady?: (port: number) => void;
  onError?: (error: Error) => void;
}

export function createLogServer(options: ServerOptions): {
  app: Express;
  start: () => Promise<Server>;
  stop: () => Promise<void>;
} {
  const { port, store, onReady, onError } = options;
  const app = express();
  let server: Server | null = null;

  app.use(express.json({ limit: "10mb" }));

  app.use((_req, _res, next) => {
    console.log(`[server] ${_req.method} ${_req.url}`);
    next();
  });

  mountMcpServer(app, store);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      logCount: store.size,
      apduCount: store.apduCount,
      uptime: process.uptime(),
    });
  });

  app.post("/logs", (req, res) => {
    const body = req.body as unknown;
    console.log(`[server] POST /logs body type=${typeof body}, isArray=${Array.isArray(body)}, keys=${body && typeof body === "object" ? Object.keys(body as object).join(",") : "n/a"}`);

    if (Array.isArray(body)) {
      const entries = store.addBatch(body);
      console.log(`[server] Accepted batch of ${entries.length} logs (store size: ${store.size})`);
      res.json({ accepted: entries.length });
    } else if (body && typeof body === "object") {
      const entry = store.add(body as { level: "info"; message: string; tag: string; timestamp: string });
      console.log(`[server] Accepted log #${entry.id}: ${entry.message} (store size: ${store.size})`);
      res.json({ accepted: 1, id: entry.id });
    } else {
      console.log(`[server] Rejected: body is ${typeof body}`);
      res.status(400).json({ error: "Expected a log entry object or array" });
    }
  });

  app.post("/clear", (_req, res) => {
    store.clear();
    res.json({ cleared: true });
  });

  app.get("/logs", (req, res) => {
    const { level, tag, search, since } = req.query;
    const entries = store.query({
      level: level as string | undefined as "debug" | "info" | "warn" | "error" | undefined,
      tag: tag as string | undefined,
      search: search as string | undefined,
      since: since ? Number(since) : undefined,
    });
    res.json(entries);
  });

  app.get("/apdu", (_req, res) => {
    res.json(store.getApduExchanges());
  });

  app.get("/export", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.json(store.toJSON());
  });

  async function start(): Promise<Server> {
    return new Promise((resolve, reject) => {
      server = app.listen(port, () => {
        onReady?.(port);
        resolve(server!);
      });
      server.on("error", (err: Error) => {
        onError?.(err);
        reject(err);
      });
    });
  }

  async function stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!server) {
        resolve();
        return;
      }
      server.close((err) => {
        server = null;
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return { app, start, stop };
}
