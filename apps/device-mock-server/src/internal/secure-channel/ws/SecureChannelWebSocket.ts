import { randomUUID } from "node:crypto";
import { type Server } from "node:http";
import { type Socket } from "node:net";

import {
  type CatalogApp,
  type Device,
} from "@ledgerhq/device-mockserver-client";
import { inject, injectable } from "inversify";
import { type WebSocket, WebSocketServer } from "ws";

import { logger } from "@internal/logger/logger";
import { secureChannelTypes } from "@internal/secure-channel/di/secureChannelTypes";
import { type FirmwareUpdateResolver } from "@internal/secure-channel/service/FirmwareUpdateResolver";
import { type InstallAppResolver } from "@internal/secure-channel/service/InstallAppResolver";
import {
  buildSecureChannelHandshake,
  buildSecureChannelScript,
  type SecureChannelEndpoint,
  type SecureChannelStep,
} from "@internal/secure-channel/service/scripts";
import { createSecureChannelFlowId } from "@internal/secure-channel/service/secureChannelApdus";
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
 *
 * A session can hold several devices, but the path has no device id. To find
 * the device, each flow puts a random flow id in its permission APDU: the
 * device the client sends that APDU to is the device the flow runs on (see
 * {@link SecureChannelWebSocket.runHandshake}).
 */
@injectable()
export class SecureChannelWebSocket {
  constructor(
    @inject(sessionTypes.Repository)
    private readonly repository: SessionRepository,
    @inject(secureChannelTypes.InstallAppResolver)
    private readonly installResolver: InstallAppResolver,
    @inject(secureChannelTypes.FirmwareUpdateResolver)
    private readonly firmwareResolver: FirmwareUpdateResolver,
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
        void this.handleConnection(ws, parsed);
      });
    });

    return wss;
  }

  private async handleConnection(
    ws: WebSocket,
    parsed: ParsedPath,
  ): Promise<void> {
    const { token, endpoint, hash, firmware, targetId } = parsed;
    const record = this.repository.findByToken(token).extract();
    if (!record) {
      closeWithError(ws, "Invalid session token");
      return;
    }
    if (this.repository.listDevices(record).length === 0) {
      closeWithError(ws, "No device in session");
      return;
    }

    // The `install` endpoint (which backs both install and uninstall) targets
    // the app identified by its hash, resolved from the Manager API like the
    // real ScriptRunner backend. The hash needs no device, so it is resolved
    // before the handshake: an unknown hash fails before the user is asked to
    // allow the connection. A firmware install needs the device's current
    // version, so it is resolved after the handshake.
    let app: CatalogApp | undefined;
    if (endpoint === "install" && hash) {
      app = (await this.installResolver.resolve(record, hash)).extract();
      if (!app) {
        // Without a resolved app the bulk would "succeed" while the device
        // context never changes, making the client's confirming re-list loop or
        // hang; fail fast with a terminal error instead.
        closeWithError(ws, `Unknown install hash: ${hash}`);
        return;
      }
    }

    const relay = new ScriptRelay(ws, record.id, endpoint);
    try {
      const device = await this.runHandshake(ws, relay, record);
      if (!device) {
        return;
      }

      // Faithful to a real device: the app is armed before the bulk is
      // streamed; the APDU layer then applies it once the final install block
      // is acknowledged, so the follow-up `apps/list` reflects the change.
      if (app) {
        this.repository.setPendingAppOperation(record, device.id, app);
      } else if (endpoint === "install" && firmware) {
        // A firmware install hits the same `install` endpoint but carries
        // `firmware`/`perso`/`firmwareKey` instead of an app `hash`. Arm the
        // target `firmware_version`, applied once the final install block is
        // acknowledged, so the device "reboots" onto the new firmware.
        if (!(await this.armFirmwareOperation(ws, record, device, targetId))) {
          return;
        }
      }

      logger.info(`Secure channel [${endpoint}] runs on device ${device.id}`);
      await relay.run(buildSecureChannelScript(endpoint, device));
    } catch (error) {
      logger.error(`Secure channel [${endpoint}] failed: ${String(error)}`);
      if (ws.readyState === ws.OPEN) {
        closeWithError(ws, "Secure channel error");
      }
    }
  }

  /**
   * Relay the handshake and return the device the flow runs on: the device the
   * client relayed the flow's permission APDU to. Returns `undefined` when the
   * flow stops during the handshake.
   */
  private async runHandshake(
    ws: WebSocket,
    relay: ScriptRelay,
    record: SessionRecord,
  ): Promise<Device | undefined> {
    const flowId = createSecureChannelFlowId();
    const completed = await relay.run(buildSecureChannelHandshake(flowId));
    // Take the binding even when the handshake stopped, so it never stays in
    // the session.
    const device = this.repository
      .takeSecureChannelFlowDevice(record, flowId)
      .extract();
    if (!completed) {
      return undefined;
    }
    if (!device) {
      closeWithError(ws, "Permission APDU reached no device");
    }
    return device;
  }

  /**
   * Arm the clean target `firmware_version` the OSU install applies on commit,
   * resolved from the Manager API like the real ScriptRunner backend. Returns
   * `false` (after closing the socket) when the next version cannot be resolved,
   * so the install fails fast instead of appearing to succeed while the device
   * stays on its old version.
   */
  private async armFirmwareOperation(
    ws: WebSocket,
    record: SessionRecord,
    device: Device,
    targetId?: string,
  ): Promise<boolean> {
    const currentVersion = device.firmware_version ?? "";
    const resolvedTargetId = targetId ?? device.masks?.[0]?.toString();
    if (resolvedTargetId === undefined) {
      closeWithError(ws, "Missing targetId for firmware update");
      return false;
    }
    const next = await this.firmwareResolver.resolveNextVersion({
      targetId: resolvedTargetId,
      currentVersion,
    });
    if (next.isNothing()) {
      closeWithError(ws, `No firmware update for ${currentVersion}`);
      return false;
    }
    this.repository.setPendingFirmwareOperation(
      record,
      device.id,
      next.unsafeCoerce(),
    );
    return true;
  }
}

/** Parsed `/secure-channel/...` upgrade path. */
interface ParsedPath {
  token: string;
  endpoint: SecureChannelEndpoint;
  /** App install hash (`install` app flow). */
  hash?: string;
  /** Firmware binary id (`install` firmware flow). */
  firmware?: string;
  /** Device target id (`install` firmware flow). */
  targetId?: string;
}

/**
 * Extract the token, endpoint and install params from a `/secure-channel/...`
 * upgrade path. The install `hash` query param identifies which app is being
 * installed; a firmware install carries `firmware`/`targetId` instead.
 */
function parsePath(url: string): ParsedPath | null {
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
  const params = new URLSearchParams(query);
  return {
    token,
    endpoint,
    hash: params.get("hash") ?? undefined,
    firmware: params.get("firmware") ?? undefined,
    targetId: params.get("targetId") ?? undefined,
  };
}

/**
 * Relays scripted steps to the client, waiting for its reply to each
 * `exchange`. A flow relays its handshake and its operation steps in two runs,
 * so the nonce and the last exchange reply carry over between them.
 */
class ScriptRelay {
  private readonly readNext: () => Promise<ClientMessage | null>;
  private nonce = 0;
  private lastExchangeData = "";

  constructor(
    private readonly ws: WebSocket,
    private readonly sessionId: string,
    private readonly endpoint: SecureChannelEndpoint,
  ) {
    this.readNext = createMessageReader(ws);
  }

  /**
   * Relay the steps in order. Resolves `false` when the client disconnects or
   * reports a device error, so the flow stops there; `true` otherwise.
   */
  async run(steps: readonly SecureChannelStep[]): Promise<boolean> {
    for (const step of steps) {
      switch (step.type) {
        case "exchange": {
          this.nonce += 1;
          send(this.ws, {
            query: "exchange",
            session: this.sessionId,
            nonce: this.nonce,
            data: step.apdu,
          });
          const reply = await this.readNext();
          if (reply === null) {
            // The client disconnected before replying: nothing more to do.
            logger.info(
              `Secure channel [${this.endpoint}] client disconnected`,
            );
            return false;
          }
          if (reply.response === "error") {
            // The client already mapped a device error and completed; stop here.
            logger.info(
              `Secure channel [${this.endpoint}] stopped on device error`,
            );
            this.ws.close();
            return false;
          }
          this.lastExchangeData = reply.data ?? "";
          break;
        }
        case "bulk": {
          send(this.ws, {
            query: "bulk",
            session: this.sessionId,
            nonce: this.nonce,
            data: step.data,
          });
          return true;
        }
        case "success": {
          // Pure relay: a terminal success either carries an explicit
          // structured payload (`listApps`) or forwards the last relayed APDU's
          // reply as the result (the verdict is owned by the resolved APDU, not
          // this relay). DMK reads `result ?? data`, so only one is ever sent.
          send(this.ws, {
            query: "success",
            session: this.sessionId,
            nonce: this.nonce,
            ...(step.data !== undefined
              ? { data: step.data }
              : { result: this.lastExchangeData }),
          });
          return true;
        }
      }
    }
    return true;
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
