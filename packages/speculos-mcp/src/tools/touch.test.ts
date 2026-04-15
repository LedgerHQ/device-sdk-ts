import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it, vi } from "vitest";

import type { CsTesterManager } from "../cs-tester-manager";
import type { SigningState } from "../dmk-session";
import type { ScreenEvent } from "../screen-events";
import type { SpeculosClient } from "../speculos-client";
import type { ToolDeps } from "./helpers";
import { register } from "./touch";

vi.useFakeTimers();

function ev(text: string): ScreenEvent {
  return { text, x: 0, y: 0, w: 1, h: 1 };
}

describe("touch tool", () => {
  it("waits for screen change before returning response", async () => {
    let touchHandler!: (args: {
      x: number;
      y: number;
      delay?: number;
    }) => Promise<{ content: [{ type: "text"; text: string }] }>;

    const server = {
      registerTool: vi.fn(
        (
          _name: string,
          _schema: unknown,
          handler: typeof touchHandler,
        ): void => {
          touchHandler = handler;
        },
      ),
    } as unknown as McpServer;

    const oldScreen = [ev("Before")];
    const newScreen = [ev("After")];

    const fetchEvents = vi
      .fn()
      .mockResolvedValueOnce(oldScreen)
      .mockResolvedValueOnce(oldScreen)
      .mockResolvedValueOnce(newScreen)
      .mockResolvedValueOnce(newScreen);

    const tap = vi.fn().mockResolvedValue(undefined);

    const client = {
      checkConnection: vi.fn(),
      fetchEvents,
      fetchScreenshot: vi.fn(),
      tap,
      setDevice: vi.fn(),
      navigate: vi.fn(),
      sign: vi.fn(),
      reject: vi.fn(),
      confirm: vi.fn(),
      dismissSecondary: vi.fn(),
    } as unknown as SpeculosClient;

    const session = {
      getSigningState: (): SigningState => ({ status: "idle" }),
    } as ToolDeps["session"];

    const deps: ToolDeps = {
      server,
      client,
      baseURL: "http://test",
      session,
      csTester: {} as CsTesterManager,
    };

    register(deps);

    const resultPromise = touchHandler({ x: 10, y: 20 });

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(200);

    const result = await resultPromise;
    const body = JSON.parse(result.content[0]!.text) as {
      screen: string;
      action: string;
      x: number;
      y: number;
    };

    expect(body.screen).toContain("After");
    expect(body.action).toBe("tap");
    expect(body.x).toBe(10);
    expect(body.y).toBe(20);
    expect(tap).toHaveBeenCalledWith(10, 20, undefined);
  });
});
