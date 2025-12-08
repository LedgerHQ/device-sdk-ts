import { type Connector } from "@ledgerhq/device-management-kit-devtools-core";
import {
  formatSocketMessage,
  parseSocketMessage,
  WEBSOCKET_MESSAGE_TYPES,
} from "@ledgerhq/device-management-kit-devtools-websocket-common";
import WebSocket from "isomorphic-ws";
import { ReplaySubject, Subject, type Subscription } from "rxjs";

type Params = {
  url: string;
};

export class DevtoolsWebSocketConnector implements Connector {
  /**
   * STATIC METHODS
   */
  static instance: DevtoolsWebSocketConnector | null = null;
  static getInstance(): DevtoolsWebSocketConnector {
    if (!DevtoolsWebSocketConnector.instance) {
      DevtoolsWebSocketConnector.instance = new DevtoolsWebSocketConnector();
    }
    return DevtoolsWebSocketConnector.instance;
  }

  static destroyInstance(): void {
    if (DevtoolsWebSocketConnector.instance) {
      DevtoolsWebSocketConnector.instance.destroy();
      DevtoolsWebSocketConnector.instance = null;
    }
  }

  /**
   * INSTANCE
   */

  private constructor() {}

  private ws: WebSocket | null = null;
  private wsUrl: string | null = null;
  private messagesToSend: ReplaySubject<{ type: string; payload: string }> =
    new ReplaySubject();
  private messagesFromDashboard: Subject<{ type: string; payload: string }> =
    new Subject();
  private messagesToSendSubscription: Subscription | null = null;
  private destroyed: boolean = false;

  /**
   * LIFE CYCLE
   */

  connect(params: Params): DevtoolsWebSocketConnector {
    console.log("[DevtoolsWebSocketConnector] 🔌 Connecting to", params.url);
    if (this.destroyed) {
      throw new Error("Connector is destroyed");
    }
    if (this.ws && this.wsUrl === params.url) {
      const mapReadyStateToText = (readyState: number) => {
        switch (readyState) {
          case WebSocket.OPEN:
            return "OPEN";
          case WebSocket.CLOSED:
            return "CLOSED";
          case WebSocket.CONNECTING:
            return "CONNECTING";
          case WebSocket.CLOSING:
            return "CLOSING";
          default:
            return "UNKNOWN";
        }
      };
      console.log(
        "[DevtoolsWebSocketConnector] Already connected to the same URL",
        params.url,
      );
      console.log(
        "[DevtoolsWebSocketConnector]",
        mapReadyStateToText(this.ws.readyState),
      );
      return this;
    }
    // Clean up old subscription if it exists
    if (this.messagesToSendSubscription) {
      this.messagesToSendSubscription.unsubscribe();
      this.messagesToSendSubscription = null;
    }
    if (this.ws) {
      console.log(
        "[DevtoolsWebSocketConnector] Already connected to different URL, closing previous connection",
      );
      this.ws.close();
    }

    console.log(
      "[DevtoolsWebSocketConnector] WebSocket connecting to",
      params.url,
    );

    this.ws = new WebSocket(params.url);
    this.wsUrl = params.url;

    this.ws.onopen = () => {
      console.log("[DevtoolsWebSocketConnector] WebSocket connected");
      if (this.reconnectionTimeout) {
        clearTimeout(this.reconnectionTimeout);
        this.reconnectionTimeout = null;
      }
      this.initialize();
    };

    this.ws.onclose = () => {
      console.log("[DevtoolsWebSocketConnector] WebSocket closed");
      this.ws = null;
      this.wsUrl = null;
    };

    this.ws.onerror = (event) => {
      console.warn("[DevtoolsWebSocketConnector] WebSocket error", event);
      if (event.target.readyState === WebSocket.CLOSED) {
        this.ws = null;
        this.wsUrl = null;
        this.scheduleReconnect(params);
      }
    };

    this.ws.onmessage = (event) => {
      console.log(
        "[DevtoolsWebSocketConnector] WebSocket message received",
        event.data,
      );
      try {
        const { type: websocketMessageType, payload: websocketMessagePayload } =
          parseSocketMessage(event.data as string);
        if (websocketMessageType === WEBSOCKET_MESSAGE_TYPES.MESSAGE) {
          try {
            const parsedMessage = JSON.parse(
              websocketMessagePayload as string,
            ) as { type?: unknown; payload?: unknown };
            const type = parsedMessage.type;
            const payload = parsedMessage.payload;
            if (typeof type !== "string" || typeof payload !== "string") {
              console.error(
                "[DevtoolsWebSocketConnector] Invalid message received",
                {
                  type,
                  payload,
                },
              );
              return;
            }
            this.messagesFromDashboard.next({ type, payload });
          } catch (error: unknown) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            console.error(
              "[DevtoolsWebSocketConnector] Failed to parse message payload",
              errorMessage,
            );
          }
        }
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          "[DevtoolsWebSocketConnector] Failed to parse message",
          errorMessage,
        );
      }
    };

    return this;
  }

  private reconnectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private scheduleReconnect(params: Params) {
    if (this.destroyed) {
      return;
    }
    console.log(
      "[DevtoolsWebSocketConnector] Scheduling reconnect in 5 seconds",
    );
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = null;
    }
    this.reconnectionTimeout = setTimeout(() => {
      console.log("[DevtoolsWebSocketConnector] Reconnecting...");
      this.connect(params);
    }, 5000);
  }

  private initialize() {
    console.log("[DevtoolsWebSocketConnector] Initializing...");
    // WebSocket.OPEN is 1
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        formatSocketMessage({
          type: WEBSOCKET_MESSAGE_TYPES.INIT,
          payload: "init message from connector",
        }),
      );
    }

    // Clean up old subscription if it exists
    if (this.messagesToSendSubscription) {
      this.messagesToSendSubscription.unsubscribe();
    }

    this.messagesToSendSubscription = this.messagesToSend.subscribe({
      next: (message) => {
        // WebSocket.OPEN is 1
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            formatSocketMessage({
              type: WEBSOCKET_MESSAGE_TYPES.MESSAGE,
              payload: JSON.stringify(message),
            }),
          );
        }
      },
    });
  }

  private destroy(): void {
    this.destroyed = true;
    if (this.messagesToSendSubscription) {
      this.messagesToSendSubscription.unsubscribe();
      this.messagesToSendSubscription = null;
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(
          "[DevtoolsWebSocketConnector] Failed to close WebSocket",
          errorMessage,
        );
      }
    }
    this.messagesToSend.complete();
    this.messagesFromDashboard.complete();
  }

  /**
   * CONNECTOR METHODS
   */

  public sendMessage(type: string, payload: string): void {
    this.messagesToSend.next({ type, payload });
  }

  public listenToMessages(listener: (type: string, payload: string) => void) {
    const subscription = this.messagesFromDashboard.subscribe({
      next: (message) => listener(message.type, message.payload),
    });
    return {
      unsubscribe: () => subscription.unsubscribe(),
    };
  }
}
