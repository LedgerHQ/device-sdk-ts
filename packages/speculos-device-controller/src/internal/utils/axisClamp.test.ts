/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import type { DeviceScreens, Percent } from "@internal/core/types";

import {
  type AxisMap,
  createAxes,
  createAxis,
  createVH,
  createVW,
} from "./axisClamp";

const p = (n: number) => n as unknown as Percent;

describe("axisClamp helpers", () => {
  describe("createVW", () => {
    it("floors and clamps to [0, width]", () => {
      const vw = createVW(200);

      expect(vw(p(0))).toBe(0);
      expect(vw(p(50))).toBe(100); // 200 * 0.5 = 100
      expect(vw(p(50.4))).toBe(100); // floor(200 * 0.504) = 100
      expect(vw(p(50.5))).toBe(101); // floor(200 * 0.505) = 101
      expect(vw(p(100))).toBe(200);
      expect(vw(p(150))).toBe(200); // clamped
      expect(vw(p(-10))).toBe(0); // clamped
    });
  });

  describe("createVH", () => {
    it("floors and clamps to [0, height]", () => {
      const vh = createVH(123);

      expect(vh(p(0))).toBe(0);
      expect(vh(p(33.3))).toBe(Math.floor(123 * 0.333)); // flooring check
      expect(vh(p(100))).toBe(123);
      expect(vh(p(999))).toBe(123); // clamped
      expect(vh(p(-5))).toBe(0); // clamped
    });
  });

  describe("createAxis", () => {
    it("exposes vw, vh and xy with consistent flooring + clamping", () => {
      const axis = createAxis(300, 200);

      // vw / vh
      expect(axis.vw(p(25))).toBe(75); // 300 * 0.25
      expect(axis.vh(p(75))).toBe(150); // 200 * 0.75

      // xy nominal
      expect(axis.xy(p(10), p(90))).toEqual({ x: 30, y: 180 });

      // xy clamps both axes
      expect(axis.xy(p(150), p(-20))).toEqual({ x: 300, y: 0 });

      // flooring behavior with fractional percent
      const xy = axis.xy(p(33.4), p(66.6));
      expect(xy.x).toBe(Math.floor(300 * 0.334));
      expect(xy.y).toBe(Math.floor(200 * 0.666));
    });
  });

  describe("createAxes", () => {
    it("creates an AxisMap for all device keys with matching dimensions", () => {
      const screens: DeviceScreens<"devA" | "devB"> = {
        devA: { width: 200, height: 100 } as any,
        devB: { width: 320, height: 480 } as any,
      };

      const axes: AxisMap<"devA" | "devB"> = createAxes(screens);

      // contains both keys
      expect(Object.keys(axes).sort()).toEqual(["devA", "devB"]);

      // devA
      expect(axes.devA.vw(p(100))).toBe(200);
      expect(axes.devA.vh(p(100))).toBe(100);
      expect(axes.devA.xy(p(120), p(-10))).toEqual({ x: 200, y: 0 });

      // devB
      expect(axes.devB.vw(p(50))).toBe(160);
      expect(axes.devB.vh(p(50))).toBe(240);
      expect(axes.devB.xy(p(33.3), p(66.7))).toEqual({
        x: Math.floor(320 * 0.333),
        y: Math.floor(480 * 0.667),
      });
    });
  });
});
