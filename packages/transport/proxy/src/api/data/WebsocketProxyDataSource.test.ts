/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RawData } from "ws";

import { createWebSocketDataSource } from "./WebsocketProxyDataSource";

class MockWebSocket {
  public readyState = 0;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  private listeners: Record<string, ((...args: any[]) => void)[]> = {};
  constructor(public url: string) {}

  send = vi.fn();
  close = vi.fn();

  // node-style
  on(event: string, cb: (...args: any[]) => void): void {
    (this.listeners[event] ||= []).push(cb);
  }
  off(event: string, cb: (...args: any[]) => void) {
    this.listeners[event] = (this.listeners[event] || []).filter(
      (fn) => fn !== cb,
    );
  }

  // browser-style
  addEventListener(event: string, cb: any) {
    return this.on(event, cb);
  }
  removeEventListener(event: string, cb: any) {
    return this.off(event, cb);
  }

  emitOpen() {
    this.readyState = MockWebSocket.OPEN;
    (this.listeners["open"] || []).forEach((cb) => cb());
  }
  emitError(err: any = new Error("socket error")) {
    (this.listeners["error"] || []).forEach((cb) => cb(err));
  }
  emitMessage(data: RawData | string) {
    (this.listeners["message"] || []).forEach((cb) => cb(data));
  }
  emitClose() {
    this.readyState = MockWebSocket.CLOSED;
    (this.listeners["close"] || []).forEach((cb) => cb());
  }
}

describe("WebSocketProxyDataSource", () => {
  let dataSource: any;
  let ws: MockWebSocket;
  let OriginalWebSocket: any;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1620000000000);

    OriginalWebSocket = globalThis.WebSocket;
    globalThis.WebSocket = MockWebSocket as unknown as any;

    const DSClass = createWebSocketDataSource(MockWebSocket as any);

    dataSource = new DSClass("ws://test");
    ws = dataSource.ws;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.WebSocket = OriginalWebSocket;
  });

  it("should open WebSocket and send raw hex payload", async () => {
    // given
    const openP = dataSource.ensureOpen();
    ws.emitOpen();
    await expect(openP).resolves.toBeUndefined();
    const hex = "f0cacc1a";

    // when
    const postP = dataSource.postAdpu(hex);

    // then
    expect(ws.send).toHaveBeenCalledWith(hex);
    ws.emitMessage(JSON.stringify({ type: "response", data: hex }));
    await expect(postP).resolves.toBe(hex);
  });

  it("should reject when response contains error", async () => {
    // given
    ws.emitOpen();

    // when
    const postP = dataSource.postAdpu("abadbeef");
    ws.emitMessage(JSON.stringify({ type: "error", error: "boom" }));

    // then
    await expect(postP).rejects.toThrow("boom");
  });

  it("should ignore malformed JSON messages", async () => {
    // given
    ws.emitOpen();
    const hex = "f0cacc1a";

    // when
    const postP = dataSource.postAdpu(hex);
    ws.emitMessage("not-json");
    ws.emitMessage(JSON.stringify({ type: "response", data: hex }));

    // then
    await expect(postP).resolves.toBe(hex);
  });

  it("should reject ensureOpen if socket errors before open", async () => {
    const openP = dataSource.ensureOpen();

    ws.emitError();

    await expect(openP).rejects.toThrow("WebSocket failed to open");
  });

  it("close() do not throw when already closing/closed", () => {
    ws.readyState = MockWebSocket.CLOSING;
    expect(() => dataSource.close()).not.toThrow();

    ws.readyState = MockWebSocket.CLOSED;
    expect(() => dataSource.close()).not.toThrow();
  });
});
