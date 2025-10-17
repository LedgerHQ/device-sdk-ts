/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import type { AxiosInstance } from "axios";

import type { PercentPoint } from "../core/types";
import { AxiosTouchController } from "./AxiosTouchController";

describe("AxiosTouchController", () => {
  let postMock: ReturnType<typeof vi.fn>;
  let axiosFake: AxiosInstance;

  const axisA = {
    xy: vi.fn((xPct: number, yPct: number) => ({
      x: Math.round(xPct * 10),
      y: Math.round(yPct * 20),
    })),
  };
  const axisB = {
    xy: vi.fn((xPct: number, yPct: number) => ({
      x: Math.round(100 + xPct),
      y: Math.round(200 + yPct),
    })),
  };
  let axesFake: Record<
    string,
    { xy: (x: number, y: number) => { x: number; y: number } }
  >;

  let controller: AxiosTouchController;

  beforeEach(() => {
    postMock = vi.fn().mockResolvedValue({ status: 200, data: {} });
    axiosFake = { post: postMock } as unknown as AxiosInstance;

    axisA.xy.mockClear();
    axisB.xy.mockClear();

    axesFake = { devA: axisA, devB: axisB };
    controller = new AxiosTouchController(axiosFake, axesFake as any);
  });

  const point: PercentPoint = { x: 12, y: 45 };

  it("tapAndRelease: converts percent to absolute via axes and POSTs expected body", async () => {
    await controller.tapAndRelease("devA", point);

    expect(axisA.xy).toHaveBeenCalledTimes(1);
    expect(axisA.xy).toHaveBeenCalledWith(point.x, point.y);

    const expectedAbs = (axisA.xy.mock.results as any)[0].value;
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith("/finger", {
      action: "press-and-release",
      ...expectedAbs,
    });
  });

  it("tap: converts via axes and POSTs action 'press'", async () => {
    await controller.tap("devB", point);

    expect(axisB.xy).toHaveBeenCalledWith(point.x, point.y);
    const expectedAbs = axisB.xy.mock.results[0]?.value;

    expect(postMock).toHaveBeenCalledWith("/finger", {
      action: "press",
      ...expectedAbs,
    });
  });

  it("release: converts via axes and POSTs action 'release'", async () => {
    await controller.release("devA", point);

    const expectedAbs = axisA.xy.mock.results[0]!.value;
    expect(postMock).toHaveBeenCalledWith("/finger", {
      action: "release",
      ...expectedAbs,
    });
  });

  it("throws an error when device key is unknown", async () => {
    await expect(controller.tap("unknownDevice" as any, point)).rejects.toThrow(
      /\[Touch] Unknown device key "unknownDevice".*Known keys: devA, devB/,
    );
    expect(postMock).not.toHaveBeenCalled();
  });

  it("propagates HTTP errors from axios client", async () => {
    const boom = new Error("backend down");
    postMock.mockRejectedValueOnce(boom);

    await expect(controller.tapAndRelease("devA", point)).rejects.toBe(boom);
  });
});

describe("percent validation", () => {
  let controller: AxiosTouchController;
  let postMock: ReturnType<typeof vi.fn>;
  let axiosFake: AxiosInstance;

  const axis = {
    xy: vi.fn((xPct: number, yPct: number) => ({ x: xPct, y: yPct })),
  };
  const axesFake = { devA: axis };

  beforeEach(() => {
    postMock = vi.fn().mockResolvedValue({ status: 200, data: {} });
    axiosFake = { post: postMock } as unknown as AxiosInstance;
    axis.xy.mockClear();
    controller = new AxiosTouchController(axiosFake, axesFake as any);
  });

  it("accepts boundary values 0 and 100", async () => {
    await controller.tapAndRelease("devA", { x: 0, y: 100 });
    await controller.tap("devA", { x: 100, y: 0 });
    await controller.release("devA", { x: 50, y: 99 });

    // should have sent 3 HTTP calls if all accepted
    expect(postMock).toHaveBeenCalledTimes(3);
  });

  it("rejects values outside [0, 100]", async () => {
    const badPoints = [
      { x: 140, y: 50 },
      { x: -1, y: 50 },
      { x: 50, y: 120 },
      { x: 50, y: -0.01 },
    ];

    for (const p of badPoints) {
      await expect(
        controller.tapAndRelease("devA", p as any),
      ).rejects.toThrow();
    }

    // no HTTP calls should be made for invalid input
    expect(postMock).not.toHaveBeenCalled();
  });

  it("rejects NaN or non-finite values", async () => {
    const badPoints = [
      { x: Number.NaN, y: 50 },
      { x: 50, y: Number.NaN },
      { x: Number.POSITIVE_INFINITY, y: 10 },
      { x: 10, y: Number.NEGATIVE_INFINITY },
    ];

    for (const p of badPoints) {
      await expect(controller.tap("devA", p as any)).rejects.toThrow(
        /percent/i,
      );
    }
    expect(postMock).not.toHaveBeenCalled();
  });
});
