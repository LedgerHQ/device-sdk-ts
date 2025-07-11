import WebSocketNode, { type RawData } from "ws";

import type { ProxyDataSource } from "./ProxyDataSource";

interface WsResponse {
  type?: string;
  data?: string;
  error?: string;
}

export const createWebSocketDataSource = (
  WebSocketImpl: typeof WebSocketNode,
) =>
  class WebSocketProxyDataSource implements ProxyDataSource {
    ws: WebSocketNode | WebSocket;
    pending = new Map<
      string,
      { resolve: (hex: string) => void; reject: (err: Error) => void }
    >();

    constructor(url: string) {
      // pick node or browser WebSocket
      const Impl =
        typeof globalThis.WebSocket === "function"
          ? globalThis.WebSocket
          : WebSocketImpl;
      this.ws = new Impl(url);

      const cleanup = () => {
        for (const { reject } of this.pending.values()) {
          reject(new Error("WebSocket closed"));
        }
        this.pending.clear();
      };

      // close
      if ("on" in this.ws) {
        (this.ws as WebSocketNode).on("close", cleanup);
      } else {
        this.ws.addEventListener("close", cleanup);
      }

      // message
      const onMsg = (data: RawData | string) => {
        let msg: WsResponse;
        try {
          msg = JSON.parse(
            typeof data === "string" ? data : data.toString(),
          ) as WsResponse;
        } catch {
          return;
        }
        if (msg.type === "response" && typeof msg.data === "string") {
          const key = this.pending.keys().next().value;
          if (!key) return;
          const h = this.pending.get(key)!;
          this.pending.delete(key);
          h.resolve(msg.data);
        } else if (msg.type === "error" && typeof msg.error === "string") {
          const key = this.pending.keys().next().value;
          if (!key) return;
          const h = this.pending.get(key)!;
          this.pending.delete(key);
          h.reject(new Error(msg.error));
        }
      };
      if ("on" in this.ws) {
        (this.ws as WebSocketNode).on("message", onMsg);
      } else {
        this.ws.addEventListener("message", (e) => onMsg(e.data));
      }
    }

    /**
     * wait for the ws to emit “open”.
     */
    ensureOpen(): Promise<void> {
      const ws = this.ws as WebSocketNode | WebSocket;
      const OPEN = (ws as WebSocket).OPEN;

      if (ws.readyState === OPEN) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => {
        // handler functions
        const onOpen = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          reject(new Error("WebSocket failed to open"));
        };

        // cleanup both kinds of listeners
        const cleanup = () => {
          if ("off" in ws && typeof (ws as WebSocketNode).off === "function") {
            // node style
            (ws as WebSocketNode).off("open", onOpen);
            (ws as WebSocketNode).off("error", onError);
          } else {
            // browser style
            (ws as EventTarget).removeEventListener("open", onOpen);
            (ws as EventTarget).removeEventListener("error", onError);
          }
        };

        // attach listeners
        if ("once" in ws && typeof (ws as WebSocketNode).once === "function") {
          (ws as WebSocketNode).once("open", onOpen);
          (ws as WebSocketNode).once("error", onError);
        } else {
          (ws as EventTarget).addEventListener("open", onOpen);
          (ws as EventTarget).addEventListener("error", onError);
        }
      });
    }

    /**
     * wait for the proxy’s “opened” handshake frame.
     */
    waitForOpened(): Promise<void> {
      return new Promise((resolve) => {
        const handler = (data: RawData | string) => {
          let msg: WsResponse;
          try {
            msg = JSON.parse(
              typeof data === "string" ? data : data.toString(),
            ) as WsResponse;
          } catch {
            return;
          }
          if (msg.type === "opened") {
            cleanup();
            resolve();
          }
        };
        let listener: (e: MessageEvent) => void;
        const cleanup = () => {
          if ("off" in this.ws) {
            (this.ws as WebSocketNode).off("message", handler);
          } else {
            this.ws.removeEventListener("message", listener);
          }
        };
        if ("on" in this.ws) {
          (this.ws as WebSocketNode).on("message", handler);
        } else {
          listener = (e: MessageEvent) => handler(e.data);
          this.ws.addEventListener("message", listener);
        }
      });
    }

    /**
     * send raw APDU hex and resolve on the next “response” frame.
     */
    postAdpu(apduHex: string): Promise<string> {
      return new Promise((resolve, reject) => {
        const key = Date.now().toString();
        this.pending.set(key, { resolve, reject });
        this.ws.send(apduHex);
      });
    }

    close(): void {
      const CLOSING = (this.ws as WebSocket).CLOSING;
      if (this.ws.readyState < CLOSING) {
        this.ws.close();
      }
    }
  };

export const WebSocketProxyDataSource =
  createWebSocketDataSource(WebSocketNode);
export type WebSocketProxyDataSourceInstance = InstanceType<
  typeof WebSocketProxyDataSource
>;
