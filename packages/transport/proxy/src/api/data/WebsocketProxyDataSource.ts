/* eslint-disable @typescript-eslint/no-explicit-any */
import type { TransportDiscoveredDevice } from "@ledgerhq/device-management-kit";
import WebSocketNode, { type RawData } from "ws";

import type { ProxyDataSource } from "@api/data/ProxyDataSource";

interface WsResponse {
  type?: string;
  list?: TransportDiscoveredDevice[];
  id?: string;
  data?: string;
  error?: string;
}

export const createWebSocketDataSource = (webSocket: typeof WebSocketNode) =>
  class WebSocketProxyDataSource implements ProxyDataSource {
    ws: WebSocketNode | WebSocket;
    pending = new Map<
      string,
      { resolve: (hex: string) => void; reject: (err: Error) => void }
    >();

    constructor(url: string) {
      const Impl =
        typeof globalThis.WebSocket === "function"
          ? globalThis.WebSocket
          : webSocket;
      this.ws = new Impl(url);

      // fail all pending when socket closes
      const cleanupPending = () => {
        for (const { reject } of this.pending.values())
          reject(new Error("WebSocket closed"));
        this.pending.clear();
      };
      if ((this.ws as WebSocketNode).on) {
        (this.ws as WebSocketNode).on("close", cleanupPending);
      } else {
        this.ws.addEventListener("close", cleanupPending);
      }

      // route JSON {type,response/error}
      const handleMessage = (data: RawData | string) => {
        let msg: WsResponse;
        try {
          msg = JSON.parse(
            typeof data === "string" ? data : data.toString(),
          ) as WsResponse;
        } catch {
          return;
        }
        if (msg.type === "response" && typeof msg.data === "string") {
          const first = this.pending.keys().next().value;
          if (!first) return;
          const h = this.pending.get(first)!;
          this.pending.delete(first);
          h.resolve(msg.data);
        } else if (msg.type === "error" && typeof msg.error === "string") {
          const first = this.pending.keys().next().value;
          if (!first) return;
          const h = this.pending.get(first)!;
          this.pending.delete(first);
          h.reject(new Error(msg.error));
        }
      };
      if ((this.ws as WebSocketNode).on) {
        (this.ws as WebSocketNode).on("message", handleMessage);
      } else {
        this.ws.addEventListener("message", (e) => handleMessage(e.data));
      }
    }

    ensureOpen(): Promise<void> {
      const OPEN = this.ws.OPEN;
      if (this.ws.readyState === OPEN) return Promise.resolve();
      return new Promise((res, rej) => {
        this.ws.addEventListener("open", () => res());
        this.ws.addEventListener("error", () =>
          rej(new Error("WS open error")),
        );
      });
    }

    waitForOpened(): Promise<void> {
      return new Promise((res) => {
        const listener = (data: RawData | string) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(
              typeof data === "string" ? data : data.toString(),
            );
          } catch {
            return;
          }
          if (
            typeof parsed === "object" &&
            parsed !== null &&
            "type" in parsed &&
            (parsed as { type: string }).type === "opened"
          ) {
            this.ws.removeEventListener("message", listener as any);
            res();
          }
        };
        this.ws.addEventListener("message", listener as any);
      });
    }

    postAdpu(apduHex: string): Promise<string> {
      this.ws.send(apduHex);
      return new Promise((resolve, reject) => {
        const key = `${Date.now()}`;
        this.pending.set(key, { resolve, reject });
      });
    }

    close(): void {
      const CLOSING = this.ws.CLOSING;
      if (this.ws.readyState < CLOSING) this.ws.close();
    }
  };

export const WebSocketProxyDataSource =
  createWebSocketDataSource(WebSocketNode);
export type WebSocketProxyDataSourceInstance = InstanceType<
  typeof WebSocketProxyDataSource
>;
