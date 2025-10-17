/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { DeviceScreens } from "@internal/core/types";

import { deviceControllerFactory } from "./DeviceController";

describe("deviceControllerFactory", () => {
  it("returns a DeviceControllerAPI with the expected shape", () => {
    const api = deviceControllerFactory("http://localhost:0");

    expect(api).toBeDefined();
    expect(api).toHaveProperty("button");
    expect(api).toHaveProperty("touch");

    // button API surface
    expect(typeof api.button.press).toBe("function");
    expect(typeof api.button.left).toBe("function");
    expect(typeof api.button.right).toBe("function");
    expect(typeof api.button.both).toBe("function");
    expect(typeof api.button.pressSequence).toBe("function");

    // touch API surface
    expect(typeof api.touch.createTap).toBe("function");

    const tap = api.touch.createTap("flex");
    expect(tap).toBeDefined();
    expect(typeof tap.tapQuick).toBe("function");
    expect(typeof tap.tapLong).toBe("function");
  });

  it("does not throw when created with custom options", () => {
    const screens: DeviceScreens<string> = {
      custom: { width: 128, height: 64 },
      stax: { width: 400, height: 672 },
    };
    const api = deviceControllerFactory("http://127.0.0.1:0", {
      clientHeader: "test-suite",
      timeoutMs: 200,
      screens,
    });
    expect(api).toBeTruthy();
  });

  it("creates independent instances (no accidental shared state)", () => {
    const a = deviceControllerFactory("http://localhost:0");
    const b = deviceControllerFactory("http://localhost:0");

    expect(a).not.toBe(b);
    expect(a.button.press).not.toBe(b.button.press);
    expect(a.touch.createTap).not.toBe(b.touch.createTap);
  });

  it("button.pressSequence resolves on empty sequences", async () => {
    const api = deviceControllerFactory("http://localhost:0");
    await expect(api.button.pressSequence([], 0)).resolves.toBeUndefined();
  });

  it("touch.createTap returns callable fns without invoking them", () => {
    const api = deviceControllerFactory("http://localhost:0");
    const { tapQuick, tapLong } = api.touch.createTap("flex");

    expect(tapQuick.length).toBe(1);
    expect(tapLong.length).toBe(1);
  });
});
