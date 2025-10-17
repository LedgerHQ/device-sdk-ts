import { type ITouchController } from "@internal/core/ITouchController";
import type { PercentPoint } from "@internal/core/types";

const TAP_LONG_TIME_MS = 5000;

export const tapLong =
  (touch: ITouchController, deviceKey: string) =>
  async (point: PercentPoint) => {
    await touch.tap(deviceKey, point);
    await new Promise((r) => setTimeout(r, TAP_LONG_TIME_MS));
    await touch.release(deviceKey, point);
  };

export const tapQuick =
  (touch: ITouchController, deviceKey: string) => async (point: PercentPoint) =>
    await touch.tapAndRelease(deviceKey, point);
