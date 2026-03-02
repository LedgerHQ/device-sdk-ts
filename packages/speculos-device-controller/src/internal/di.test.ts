/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it, vi } from "vitest";

import { DefaultButtonController } from "@internal/adapters/DefaultButtonController";
import { DefaultTouchController } from "@internal/adapters/DefaultTouchController";

import { createDefaultControllers } from "./di";

const SCREENS = {
  flex: { width: 128, height: 64 },
  stax: { width: 400, height: 672 },
} as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createDefaultControllers - fetch configuration", () => {
  it("configures with custom timeout and header", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    const { buttons } = createDefaultControllers("http://example.com/api", {
      screens: SCREENS,
      timeoutMs: 2345,
      clientHeader: "test-client",
    });

    await buttons.press("left");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://example.com/api/button/left",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Ledger-Client-Version": "test-client",
        }),
      }),
    );
  });

  it("applies default timeout and client header when not provided", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    const { buttons } = createDefaultControllers("http://localhost:1234", {
      screens: SCREENS,
    });

    await buttons.press("left");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://localhost:1234/button/left",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Ledger-Client-Version": "ldmk-transport-speculos",
        }),
      }),
    );
  });
});

describe("createDefaultControllers - wiring", () => {
  it("returns correct controller implementations", () => {
    const { buttons, touch } = createDefaultControllers("http://x", {
      screens: SCREENS,
    });

    expect(buttons).toBeInstanceOf(DefaultButtonController);
    expect(touch).toBeInstanceOf(DefaultTouchController);
    expect(typeof buttons.press).toBe("function");
  });

  it("creates fresh instances per invocation", () => {
    const a = createDefaultControllers("http://x", { screens: SCREENS });
    const b = createDefaultControllers("http://x", { screens: SCREENS });

    expect(a.buttons).not.toBe(b.buttons);
    expect(a.touch).not.toBe(b.touch);
  });

  it("button.press posts the correct payload", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    const { buttons } = createDefaultControllers("http://x", {
      screens: SCREENS,
    });

    await buttons.press("left");

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://x/button/left",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "press-and-release" }),
      }),
    );
  });

  it("touch.tapAndRelease maps percent to absolute coords", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}"));

    const { touch } = createDefaultControllers("http://x", {
      screens: SCREENS,
    });

    // 50% of 128x64 → (64, 32)
    await touch.tapAndRelease("flex", { x: 50 as any, y: 50 as any });

    expect(fetchSpy).toHaveBeenCalledWith(
      "http://x/finger",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "press-and-release",
          x: 64,
          y: 32,
        }),
      }),
    );
  });
});
