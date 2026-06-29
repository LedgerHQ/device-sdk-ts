import { randomUUID } from "node:crypto";
import { type Server } from "node:http";
import { type Socket } from "node:net";

import { type Device } from "@ledgerhq/device-mockserver-client";
import { inject, injectable } from "inversify";
import { type WebSocket, WebSocketServer } from "ws";

import { logger } from "@internal/logger/logger";
import { secureChannelTypes } from "@internal/secure-channel/di/secureChannelTypes";
import { type InstallAppResolver } from "@internal/secure-channel/service/InstallAppResolver";
import {
  buildSecureChannelScript,
  type SecureChannelEndpoint,
} from "@internal/secure-channel/service/scripts";
import { type SessionRepository } from "@internal/session/data/SessionRepository";
import { sessionTypes } from "@internal/session/di/sessionTypes";
import { type SessionRecord } from "@internal/session/model/SessionModels";

const PATH_PREFIX = "/secure-channel/";

/** Map the WebSocket sub-path to a secure-channel endpoint. */
const ENDPOINTS: Record<string, SecureChannelEndpoint> = {
  genuine: "genuine",
  "apps/list": "listApps",
  install: "install",
  mcu: "mcu",
};

/** Message a connected client sends back for each `exchange`. */
interface ClientMessage {
  readonly nonce?: number;
  readonly response?: string;
  readonly data?: string;
}

/**
 * Mock ScriptRunner WebSocket server. It speaks the DMK secure-channel protocol
 * (`exchange` / `success` / `bulk`) on `/secure-channel/<token>/<endpoint>`,
 * where `<token>` is the mock-server session token (the secure-channel
 * WebSocket carries no bearer header, so the token is embedded in the path).
 */
@injectable()
export class SecureChannelWebSocket {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
    @inject(secureChannelTypes.InstallAppResolver)
    private readonly installResolver: InstallAppResolver,
  ) {}

  /** Attach the secure-channel WebSocket handler to an HTTP server. */
  attach(server: Server): WebSocketServer {
    const wss = new WebSocketServer({ noServer: true });

    server.on("upgrade", (request, socket: Socket, head) => {
      const parsed = parsePath(request.url ?? "");
      if (!parsed) {
        socket.destroy();
        return;
      }
      wss.handleUpgrade(request, socket, head, (ws) => {
        void this.handleConnection(
          ws,
          parsed.token,
          parsed.endpoint,
          parsed.hash,
        );
      });
    });

    return wss;
  }

  private async handleConnection(
    ws: WebSocket,
    token: string,
    endpoint: SecureChannelEndpoint,
    hash?: string,
  ): Promise<void> {
    const record = this.repository.findByToken(token).extract();
    if (!record) {
      closeWithError(ws, "Invalid session token");
      return;
    }
    const device = this.pickDevice(record);
    if (!device) {
      closeWithError(ws, "No device in session");
      return;
    }

    // Faithful to a real device: `install` arms the app identified by its hash
    // (resolved from the Manager API, like the real ScriptRunner backend) before
    // the bulk is streamed; the APDU layer then commits it once the final install
    // block is acknowledged, so the post-install `apps/list` reflects it.
    if (endpoint === "install" && hash) {
      const app = await this.installResolver.resolve(record, hash);
      app.ifJust((resolved) =>
        this.repository.setPendingInstall(record, device.id, resolved),
      );
    }

    logger.info(`Secure channel [${endpoint}] opened for device ${device.id}`);
    try {
      await runScript(ws, endpoint, record, device);
    } catch (error) {
      logger.error(`Secure channel [${endpoint}] failed: ${String(error)}`);
      if (ws.readyState === ws.OPEN) {
        closeWithError(ws, "Secure channel error");
      }
    }
  }

  /** Prefer the connected device; fall back to the first one in the session. */
  private pickDevice(record: SessionRecord): Device | undefined {
    const devices = this.repository.listDevices(record);
    return devices.find((device) => device.connected) ?? devices[0];
  }
}

/**
 * Extract `{ token, endpoint, hash? }` from a `/secure-channel/...` upgrade
 * path. The install `hash` query param identifies which app is being installed.
 */
function parsePath(
  url: string,
): { token: string; endpoint: SecureChannelEndpoint; hash?: string } | null {
  const [pathname = "", query = ""] = url.split("?");
  if (!pathname.startsWith(PATH_PREFIX)) {
    return null;
  }
  const segments = pathname
    .slice(PATH_PREFIX.length)
    .split("/")
    .filter(Boolean);
  if (segments.length < 2) {
    return null;
  }
  const token = segments[0]!;
  const endpoint = ENDPOINTS[segments.slice(1).join("/")];
  if (!endpoint) {
    return null;
  }
  const hash = new URLSearchParams(query).get("hash") ?? undefined;
  return { token, endpoint, hash };
}

/** Run the scripted message sequence, relaying `exchange` APDUs to the client. */
async function runScript(
  ws: WebSocket,
  endpoint: SecureChannelEndpoint,
  record: SessionRecord,
  device: Device,
): Promise<void> {
  const readNext = createMessageReader(ws);
  let nonce = 0;
  let lastExchangeData = "";

  for (const step of buildSecureChannelScript(endpoint, device)) {
    switch (step.type) {
      case "exchange": {
        nonce += 1;
        send(ws, {
          query: "exchange",
          session: record.id,
          nonce,
          data: step.apdu,
        });
        const reply = await readNext();
        if (reply === null) {
          // The client disconnected before replying: nothing more to do.
          logger.info(`Secure channel [${endpoint}] client disconnected`);
          return;
        }
        if (reply.response === "error") {
          // The client already mapped a device error and completed; stop here.
          logger.info(`Secure channel [${endpoint}] stopped on device error`);
          ws.close();
          return;
        }
        lastExchangeData = reply.data ?? "";
        break;
      }
      case "bulk": {
        send(ws, { query: "bulk", session: record.id, nonce, data: step.data });
        return;
      }
      case "success": {
        // Pure relay: a terminal success either carries an explicit structured
        // payload (`listApps`) or forwards the last relayed APDU's reply as the
        // result (the verdict is owned by the resolved APDU, not this relay).
        // DMK reads `result ?? data`, so only one is ever sent.
        send(ws, {
          query: "success",
          session: record.id,
          nonce,
          ...(step.data !== undefined
            ? { data: step.data }
            : { result: lastExchangeData }),
        });
        return;
      }
    }
  }
}

/** Serialize and send a server message in the DMK secure-channel envelope. */
function send(
  ws: WebSocket,
  message: {
    query: string;
    session: string;
    nonce: number;
    result?: unknown;
    data?: unknown;
  },
): void {
  ws.send(JSON.stringify({ uuid: randomUUID(), ...message }));
}

function closeWithError(ws: WebSocket, message: string): void {
  send(ws, { query: "error", session: "", nonce: 0, data: message });
  ws.close();
}

/**
 * Build a reader that resolves the next client message, queueing any that
 * arrive before they are awaited and resolving `null` once the socket closes.
 */
function createMessageReader(
  ws: WebSocket,
): () => Promise<ClientMessage | null> {
  const queue: ClientMessage[] = [];
  let pending: ((message: ClientMessage | null) => void) | null = null;
  let closed = false;

  const deliver = (message: ClientMessage | null) => {
    if (pending) {
      const resolve = pending;
      pending = null;
      resolve(message);
    } else if (message) {
      queue.push(message);
    }
  };

  ws.on("message", (raw) => {
    try {
      deliver(JSON.parse(raw.toString()) as ClientMessage);
    } catch {
      logger.warn("Secure channel: ignoring non-JSON client message");
    }
  });
  ws.on("close", () => {
    closed = true;
    deliver(null);
  });

  return () =>
    new Promise<ClientMessage | null>((resolve) => {
      const next = queue.shift();
      if (next !== undefined) {
        resolve(next);
      } else if (closed) {
        resolve(null);
      } else {
        pending = resolve;
      }
    });
}
