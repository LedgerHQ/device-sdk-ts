/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { DeviceScreens } from "@internal/core/types";

import { deviceControllerClientFactory } from "./DeviceController";

describe("deviceControllerClientFactory", () => {
  it("returns a DeviceControllerdeviceClient with the expected shape", () => {
    const deviceClient = deviceControllerClientFactory("http://localhost:0");

    expect(deviceClient).toBeDefined();
    expect(deviceClient).toHaveProperty("buttonFactory");
    expect(deviceClient).toHaveProperty("tapFactory");

    const deviceButtons = deviceClient.buttonFactory();

    // button surfaces
    expect(typeof deviceButtons.press).toBe("function");
    expect(typeof deviceButtons.left).toBe("function");
    expect(typeof deviceButtons.right).toBe("function");
    expect(typeof deviceButtons.both).toBe("function");
    expect(typeof deviceButtons.pressSequence).toBe("function");

    const deviceTaps = deviceClient.tapFactory("flex");

    // tap surfaces
    expect(typeof deviceTaps.tapQuick).toBe("function");
    expect(typeof deviceTaps.tapLong).toBe("function");
  });

  it("does not throw when created with custom options", () => {
    const screens: DeviceScreens<string> = {
      custom: { width: 128, height: 64 },
      stax: { width: 400, height: 672 },
    };
    const deviceClient = deviceControllerClientFactory("http://127.0.0.1:0", {
      clientHeader: "test-suite",
      timeoutMs: 200,
      screens,
    });
    expect(deviceClient).toBeTruthy();
  });

  it("creates independent instances (no accidental shared state)", () => {
    const a = deviceControllerClientFactory("http://localhost:0");
    const b = deviceControllerClientFactory("http://localhost:0");

    expect(a).not.toBe(b);
    expect(a.buttonFactory().press).not.toBe(b.buttonFactory().press);
    expect(a.tapFactory("flex").tapQuick).not.toBe(
      b.tapFactory("flex").tapQuick,
    );
  });
});
