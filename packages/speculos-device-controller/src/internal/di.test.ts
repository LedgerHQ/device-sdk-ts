/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import axios from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AxiosButtonController } from "@internal/adapters/AxiosButtonController";
import { AxiosTouchController } from "@internal/adapters/AxiosTouchController";

import { createDefaultControllers } from "./di";

const SCREENS = {
  flex: { width: 128, height: 64 },
  stax: { width: 400, height: 672 },
} as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createDefaultControllers - axios configuration", () => {
  it("configures axios with normalised baseURL, custom timeout and header", () => {
    const createSpy = vi
      .spyOn(axios, "create")
      .mockImplementation((cfg: any) => {
        return { post: vi.fn(), defaults: { ...cfg } } as any;
      });

    createDefaultControllers("http://example.com/api///", {
      screens: SCREENS,
      timeoutMs: 2345,
      clientHeader: "test-client",
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const cfg = createSpy.mock.calls[0]![0] as any;
    expect(cfg.baseURL).toBe("http://example.com/api");
    expect(cfg.timeout).toBe(2345);
    expect(cfg.headers?.["X-Ledger-Client-Version"]).toBe("test-client");
    expect(cfg.transitional?.clarifyTimeoutError).toBe(true);
  });

  it("applies default timeout and client header when not provided", () => {
    const createSpy = vi
      .spyOn(axios, "create")
      .mockImplementation((cfg: any) => {
        return { post: vi.fn(), defaults: { ...cfg } } as any;
      });

    createDefaultControllers("http://localhost:1234////", { screens: SCREENS });

    const cfg = createSpy.mock.calls[0]![0] as any;
    expect(cfg.baseURL).toBe("http://localhost:1234");
    expect(cfg.timeout).toBe(1500);
    expect(cfg.headers?.["X-Ledger-Client-Version"]).toBe(
      "ldmk-transport-speculos",
    );
  });
});

describe("createDefaultControllers - wiring", () => {
  it("returns axios implementations wired by the factory", () => {
    const http = { post: vi.fn() } as any;
    vi.spyOn(axios, "create").mockReturnValue(http);

    const { buttons, touch } = createDefaultControllers("http://x", {
      screens: SCREENS,
    });

    expect(buttons).toBeInstanceOf(AxiosButtonController);
    expect(touch).toBeInstanceOf(AxiosTouchController);
    expect(typeof (buttons as any).press).toBe("function");
  });

  it("creates fresh instances per invocation", () => {
    vi.spyOn(axios, "create")
      .mockReturnValueOnce({ post: vi.fn() } as any)
      .mockReturnValueOnce({ post: vi.fn() } as any);

    const a = createDefaultControllers("http://x", { screens: SCREENS });
    const b = createDefaultControllers("http://x", { screens: SCREENS });

    expect(a.buttons).not.toBe(b.buttons);
    expect(a.touch).not.toBe(b.touch);
  });

  it("button.press posts the correct payload", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(axios, "create").mockReturnValue({ post } as any);

    const { buttons } = createDefaultControllers("http://x", {
      screens: SCREENS,
    });

    await buttons.press("left");
    expect(post).toHaveBeenCalledWith("/button/left", {
      action: "press-and-release",
    });
  });

  it("touch.tapAndRelease maps percent to absolute coords", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(axios, "create").mockReturnValue({ post } as any);

    const { touch } = createDefaultControllers("http://x", {
      screens: SCREENS,
    });

    // 50% of 128x64 → (64, 32)
    await touch.tapAndRelease("flex", { x: 50 as any, y: 50 as any });

    expect(post).toHaveBeenCalledWith("/finger", {
      action: "press-and-release",
      x: 64,
      y: 32,
    });
  });
});
