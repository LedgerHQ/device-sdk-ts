/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { TouchController } from "@root/src/internal/core/TouchController";

import {
  acceptBlindSigning,
  confirmAddressBookReview,
  continueToBlindSigning,
  enableBlindSigningSettings,
  enterMenu,
  exitMenu,
  mainButton,
  navigateNext,
  navigatePrevious,
  reject,
  secondaryButton,
  sign,
  tapLong,
  tapQuick,
} from "./touchUseCases";

describe("touchUsecases", () => {
  const deviceKey = "devA";
  const point = { x: 50, y: 30 } as any;

  let controller: TouchController;

  beforeEach(() => {
    controller = {
      tap: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      tapAndRelease: vi.fn().mockResolvedValue(undefined),
    } as unknown as TouchController;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("tapQuick calls tapAndRelease with the same deviceKey and point", async () => {
    const quick = tapQuick(controller, deviceKey);
    await quick(point);

    expect(controller.tapAndRelease).toHaveBeenCalledTimes(1);
    expect(controller.tapAndRelease).toHaveBeenCalledWith(deviceKey, point);
    expect(controller.tap).not.toHaveBeenCalled();
    expect(controller.release).not.toHaveBeenCalled();
  });

  it("tapLong taps, waits default timeout, then releases", async () => {
    vi.useFakeTimers();
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const longTap = tapLong(controller, deviceKey);
    const run = longTap(point);

    await Promise.resolve();

    expect(controller.tap).toHaveBeenCalledTimes(1);
    expect(controller.tap).toHaveBeenCalledWith(deviceKey, point);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 5000);
    expect(controller.release).not.toHaveBeenCalled();

    // let the 5s timer elapse
    await vi.advanceTimersByTimeAsync(5000);
    await run;

    expect(controller.release).toHaveBeenCalledTimes(1);
    expect(controller.release).toHaveBeenCalledWith(deviceKey, point);
  });

  it("tapLong uses the provided delayMs value", async () => {
    vi.useFakeTimers();
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const customMs = 1234;
    const longTap = tapLong(controller, deviceKey);
    const run = longTap(point, customMs);

    await Promise.resolve();

    expect(controller.tap).toHaveBeenCalledTimes(1);
    expect(controller.tap).toHaveBeenCalledWith(deviceKey, point);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), customMs);
    expect(controller.release).not.toHaveBeenCalled();

    // advance exactly customMs and ensure release happens then
    await vi.advanceTimersByTimeAsync(customMs);
    await run;

    expect(controller.release).toHaveBeenCalledTimes(1);
    expect(controller.release).toHaveBeenCalledWith(deviceKey, point);
  });

  it("tapLong propagates error if tap() rejects (no release)", async () => {
    vi.useFakeTimers();

    const boom = new Error("tap failed");
    (controller.tap as any).mockRejectedValueOnce(boom);

    const longTap = tapLong(controller, deviceKey);
    const p = longTap(point);

    // attach rejection handler immediately
    await expect(p).rejects.toThrow("tap failed");
    expect(controller.release).not.toHaveBeenCalled();
  });

  it("tapLong propagates error if release() rejects", async () => {
    vi.useFakeTimers();

    const boom = new Error("release failed");
    (controller.release as any).mockRejectedValueOnce(boom);

    const p = tapLong(controller, deviceKey)(point);

    const assertion = expect(p).rejects.toThrow("release failed");

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5000);

    await assertion;

    expect(controller.tap).toHaveBeenCalledTimes(1);
    expect(controller.release).toHaveBeenCalledTimes(1);
  });

  describe("enableBlindSigningSettings", () => {
    it.each([
      ["stax", { x: 88, y: 51 }],
      ["flex", { x: 88, y: 58 }],
      ["apex", { x: 88, y: 58 }],
    ] as const)(
      "taps the blind-signing toggle at the %s coordinates",
      async (key, expected) => {
        await enableBlindSigningSettings(controller, key)();

        expect(controller.tapAndRelease).toHaveBeenCalledTimes(1);
        expect(controller.tapAndRelease).toHaveBeenCalledWith(key, expected);
      },
    );

    it("falls back to default coordinates for an unknown device key", async () => {
      const unknownKey = "unknown";
      await enableBlindSigningSettings(controller, unknownKey)();

      expect(controller.tapAndRelease).toHaveBeenCalledTimes(1);
      expect(controller.tapAndRelease).toHaveBeenCalledWith(unknownKey, {
        x: 88,
        y: 51,
      });
    });
  });

  describe("fixed-coordinate taps", () => {
    it.each([
      ["reject", reject, { x: 20, y: 90 }],
      ["navigateNext", navigateNext, { x: 90, y: 90 }],
      ["navigatePrevious", navigatePrevious, { x: 45, y: 90 }],
      ["mainButton", mainButton, { x: 50, y: 80 }],
      ["secondaryButton", secondaryButton, { x: 50, y: 90 }],
      ["enterMenu", enterMenu, { x: 85, y: 8 }],
      ["exitMenu", exitMenu, { x: 10, y: 4 }],
      ["continueToBlindSigning", continueToBlindSigning, { x: 50, y: 94 }],
      ["acceptBlindSigning", acceptBlindSigning, { x: 50, y: 94 }],
    ] as const)("%s taps %o", async (_name, useCase, expected) => {
      await useCase(controller, deviceKey)();

      expect(controller.tapAndRelease).toHaveBeenCalledTimes(1);
      expect(controller.tapAndRelease).toHaveBeenCalledWith(
        deviceKey,
        expected,
      );
    });
  });

  describe("sign", () => {
    const HOLD_TO_SIGN = { x: 85, y: 80 };

    it("holds the sign button for the default 5s", async () => {
      vi.useFakeTimers();
      const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const run = sign(controller, deviceKey)();
      await Promise.resolve();

      expect(controller.tap).toHaveBeenCalledWith(deviceKey, HOLD_TO_SIGN);
      expect(timeoutSpy).toHaveBeenLastCalledWith(expect.any(Function), 5000);

      await vi.advanceTimersByTimeAsync(5000);
      await run;

      expect(controller.release).toHaveBeenCalledWith(deviceKey, HOLD_TO_SIGN);
    });

    it("holds the sign button for the provided delay", async () => {
      vi.useFakeTimers();
      const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

      const customMs = 250;
      const run = sign(controller, deviceKey)(customMs);
      await Promise.resolve();

      expect(timeoutSpy).toHaveBeenLastCalledWith(
        expect.any(Function),
        customMs,
      );

      await vi.advanceTimersByTimeAsync(customMs);
      await run;

      expect(controller.release).toHaveBeenCalledTimes(1);
    });
  });

  describe("confirmAddressBookReview", () => {
    // The Address Book review puts its Confirm button above the page footer,
    // so these coordinates are measured per model rather than shared with
    // mainButton/secondaryButton.
    it.each([
      ["stax", { x: 50, y: 77 }],
      ["flex", { x: 50, y: 72 }],
    ] as const)(
      "taps the Confirm button at the %s coordinates",
      async (key, expected) => {
        await confirmAddressBookReview(controller, key)();

        expect(controller.tapAndRelease).toHaveBeenCalledTimes(1);
        expect(controller.tapAndRelease).toHaveBeenCalledWith(key, expected);
      },
    );

    it("falls back to Flex coordinates for an unmeasured device key", async () => {
      const unknownKey = "apex";
      await confirmAddressBookReview(controller, unknownKey)();

      expect(controller.tapAndRelease).toHaveBeenCalledTimes(1);
      expect(controller.tapAndRelease).toHaveBeenCalledWith(unknownKey, {
        x: 50,
        y: 72,
      });
    });
  });
});
