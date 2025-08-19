import { type ITouchController } from "@internal/core/ITouchController";
import type { PercentPoint } from "@internal/core/types";

export const tapLong =
  (touch: ITouchController, deviceKey: string) =>
  async (point: PercentPoint) => {
    await touch.tap(deviceKey, point);
    await new Promise((r) => setTimeout(r, 5000));
    await touch.release(deviceKey, point);
  };

export const tapQuick =
  (touch: ITouchController, deviceKey: string) => async (point: PercentPoint) =>
    await touch.tapAndRelease(deviceKey, point);
