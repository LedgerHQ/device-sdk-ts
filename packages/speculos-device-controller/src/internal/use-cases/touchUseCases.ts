import type { PercentCoordinates } from "@internal/core/types";
import { type TouchController } from "@root/src/internal/core/TouchController";

const TAP_LONG_TIME_MS = 5000;

export const tapLong =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async (point: PercentCoordinates, delayMs: number = TAP_LONG_TIME_MS) => {
    await touch.tap(deviceKey, point);
    await new Promise((r) => setTimeout(r, delayMs));
    await touch.release(deviceKey, point);
  };

export const tapQuick =
  <K extends string>(touch: TouchController<K>, deviceKey: K) =>
  async (point: PercentCoordinates) =>
    await touch.tapAndRelease(deviceKey, point);
