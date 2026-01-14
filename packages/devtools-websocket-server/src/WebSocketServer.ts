import {
  DEFAULT_CLIENT_PORT,
  DEFAULT_DASHBOARD_PORT,
  formatSocketMessage,
  parseSocketMessage,
  WEBSOCKET_MESSAGE_TYPES,
} from "@ledgerhq/device-management-kit-devtools-websocket-common";
import { ReplaySubject, type Subscription } from "rxjs";
import { WebSocket, WebSocketServer } from "ws";

export type ServerConfig = {
  clientPort?: number;
  dashboardPort?: number;
};

type ConnectionType = "client" | "dashboard";

interface ConnectionState {
  server: WebSocketServer | null;
  connection: WebSocket | null;
  /**
   * Messages to be forwarded to the opposite connection.
   */
  messageBuffer: ReplaySubject<string>;
  /**
   * Subscription to the message buffer.
   */
  messageBufferSubscription: Subscription | null;
}

export class DevToolsWebSocketServer {
  private readonly clientPort: number;
  private readonly dashboardPort: number;

  // Use a map to handle both connections uniformly
  private connections: Record<ConnectionType, ConnectionState> = {
    client: {
      server: null,
      connection: null,
      messageBuffer: new ReplaySubject(),
      messageBufferSubscription: null,
    },
    dashboard: {
      server: null,
      connection: null,
      messageBuffer: new ReplaySubject(),
      messageBufferSubscription: null,
    },
  };

  constructor(config: ServerConfig = {}) {
    this.clientPort = config.clientPort ?? DEFAULT_CLIENT_PORT;
    this.dashboardPort = config.dashboardPort ?? DEFAULT_DASHBOARD_PORT;
  }

  private log(...args: Parameters<typeof console.log>) {
    console.log(
      new Date().toLocaleTimeString() + " [DevToolsWebSocketServer]",
      ...args,
    );
  }

  private logError(...args: Parameters<typeof console.error>) {
    console.error(
      new Date().toLocaleTimeString() + " [DevToolsWebSocketServer]",
      ...args,
    );
  }

  private logWarning(...args: Parameters<typeof console.warn>) {
    console.warn(
      new Date().toLocaleTimeString() + " [DevToolsWebSocketServer]",
      ...args,
    );
  }

  private getOppositeType(type: ConnectionType): ConnectionType {
    return type === "client" ? "dashboard" : "client";
  }

  private logConnectionState(): void {
    function mapStateToText(state: number | undefined) {
      switch (state) {
        case WebSocket.OPEN:
          return "✅ OPEN";
        case WebSocket.CLOSED:
          return "❌ CLOSED";
        case WebSocket.CONNECTING:
          return "🔄 CONNECTING";
        case WebSocket.CLOSING:
          return "🔄❌ CLOSING";
        default:
          return "❓ UNKNOWN";
      }
    }

    this.log(
      ` Connection state:\n` +
        `  - Client connection: ${mapStateToText(this.connections.client.connection?.readyState)}\n` +
        `  - Dashboard connection: ${mapStateToText(this.connections.dashboard.connection?.readyState)}`,
    );
  }

  start(): void {
    this.log(
      `Starting servers on ports ${this.clientPort} (client) and ${this.dashboardPort} (dashboard)`,
    );

    this.startServer("client", this.clientPort);
    this.startServer("dashboard", this.dashboardPort);

    this.log("Servers started successfully");
  }

  private startServer(type: ConnectionType, port: number): void {
    const state = this.connections[type];
    state.server = new WebSocketServer({ port });

    state.server.on("connection", (ws: WebSocket) => {
      this.log(`🔌 ${type} connected`);
      this.logConnectionState();

      state.connection = ws;
      this.setupConnection(ws, type);
      this.setupMessageForwardingTo(type);
    });

    state.server.on("error", (error: Error) => {
      this.logError(`💥 ${type} server error:`, error);
    });
  }

  private setupConnection(ws: WebSocket, connectionType: ConnectionType): void {
    ws.on("message", (data: Buffer) => {
      try {
        const parsed = parseSocketMessage(data.toString());
        const messageType = parsed.type;
        const payload = parsed.payload;

        if (typeof messageType !== "string" || typeof payload !== "string") {
          this.logError(`Invalid message format from ${connectionType}`, {
            type: messageType,
            payload,
          });
          return;
        }

        if (messageType === WEBSOCKET_MESSAGE_TYPES.INIT) {
          this.logConnectionState();
          this.log(`Received init message from ${connectionType}:`, payload);
          return;
        }

        if (messageType === WEBSOCKET_MESSAGE_TYPES.MESSAGE) {
          this.forwardMessage(connectionType, payload);
          return;
        }

        this.logWarning(
          `Unknown message type from ${connectionType}:`,
          messageType,
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logError(
          `Failed to parse message from ${connectionType}:`,
          errorMessage,
        );
      }
    });

    ws.on("close", () => {
      this.log(`🔌❌ ${connectionType} disconnected`);
      this.handleDisconnect(connectionType);
    });

    ws.on("error", (error: Error) => {
      this.logError(`${connectionType} connection error:`, error);
    });
  }

  private handleDisconnect(connectionType: ConnectionType): void {
    const state = this.connections[connectionType];
    state.connection = null;

    // Clean up subscription on THIS side (for messages going out)
    this.cleanupSubscription(connectionType);

    // Also clean up subscription on OPPOSITE side (for messages coming in)
    // This ensures when we reconnect, we create a fresh subscription
    const oppositeType = this.getOppositeType(connectionType);
    this.cleanupSubscription(oppositeType);

    // Reset buffers based on connection type
    if (connectionType === "client") {
      // Reset both buffers when client disconnects
      this.resetMessageBuffer("client");
      this.resetMessageBuffer("dashboard");
      this.setupMessageForwardingTo("client");
      this.setupMessageForwardingTo("dashboard");
    } else {
      // Reset dashboard-to-client buffer when dashboard disconnects
      this.resetMessageBuffer("dashboard");
      this.setupMessageForwardingTo("client");
    }
  }

  private forwardMessage(
    fromConnectionType: ConnectionType,
    payload: string,
  ): void {
    // Always emit to the appropriate ReplaySubject
    this.connections[fromConnectionType].messageBuffer.next(payload);
  }

  private resetMessageBuffer(connectionType: ConnectionType): void {
    const state = this.connections[connectionType];
    state.messageBuffer.complete();
    state.messageBuffer = new ReplaySubject<string>();
  }

  private setupMessageForwardingTo(toConnectionType: ConnectionType): void {
    const state = this.connections[toConnectionType];
    const oppositeType = this.getOppositeType(toConnectionType);
    const oppositeState = this.connections[oppositeType];

    // Set up forwarding from the opposite connection to this one
    if (state.connection && state.connection.readyState === WebSocket.OPEN) {
      // Always clean up existing subscription first to ensure fresh subscription
      if (oppositeState.messageBufferSubscription) {
        oppositeState.messageBufferSubscription.unsubscribe();
        oppositeState.messageBufferSubscription = null;
      }
      // Create new subscription - this will replay all buffered messages
      oppositeState.messageBufferSubscription =
        oppositeState.messageBuffer.subscribe({
          next: (payload) => {
            if (
              state.connection &&
              state.connection.readyState === WebSocket.OPEN
            ) {
              this.log(
                `Forwarding message from ${oppositeType} to ${toConnectionType}`,
              );
              state.connection.send(
                formatSocketMessage({
                  type: WEBSOCKET_MESSAGE_TYPES.MESSAGE,
                  payload,
                }),
              );
            }
          },
        });
    }
  }

  private cleanupSubscription(type: ConnectionType): void {
    const state = this.connections[type];
    if (state.messageBufferSubscription) {
      state.messageBufferSubscription.unsubscribe();
      state.messageBufferSubscription = null;
    }
  }

  async stop(): Promise<void> {
    this.log("Stopping servers...");

    // Clean up all subscriptions
    this.cleanupSubscription("client");
    this.cleanupSubscription("dashboard");

    // Close all connections
    this.connections.client.connection?.close();
    this.connections.dashboard.connection?.close();
    this.connections.client.connection = null;
    this.connections.dashboard.connection = null;

    // Close servers
    return new Promise<void>((resolve) => {
      let closedCount = 0;
      const checkClosed = () => {
        closedCount++;
        if (closedCount === 2) {
          this.log("Servers stopped");
          resolve();
        }
      };

      const closeServer = (type: ConnectionType) => {
        const state = this.connections[type];
        if (state.server) {
          state.server.close(() => {
            state.server = null;
            checkClosed();
          });
        } else {
          checkClosed();
        }
      };

      closeServer("client");
      closeServer("dashboard");
    });
  }

  destroy(): void {
    this.stop();
  }
}
