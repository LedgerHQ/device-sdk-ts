/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import type { ITouchController } from "@internal/core/ITouchController";

import { tapLong, tapQuick } from "./touchUseCases";

describe("touchUsecases", () => {
  const deviceKey = "devA";
  const point = { x: 50, y: 30 } as any;

  let controller: ITouchController;

  beforeEach(() => {
    controller = {
      tap: vi.fn().mockResolvedValue(undefined),
      release: vi.fn().mockResolvedValue(undefined),
      tapAndRelease: vi.fn().mockResolvedValue(undefined),
    } as unknown as ITouchController;
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

  it("tapLong taps, waits 5000ms, then releases", async () => {
    vi.useFakeTimers();
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    const longTap = tapLong(controller, deviceKey);
    const run = longTap(point);

    // allow await controller.tap(...) to resolve and the timeout to be scheduled
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
});
