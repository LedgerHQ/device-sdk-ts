import type { AxiosInstance } from "axios";

import { type PercentCoordinates, SpeculosActions } from "@internal/core/types";
import type { AxisMap } from "@internal/utils/axisClamp";
import type { TouchController } from "@root/src/internal/core/TouchController";

export class DefaultTouchController<K extends string>
  implements TouchController<K>
{
  constructor(
    private readonly client: AxiosInstance,
    private readonly axes: AxisMap<K>,
  ) {}

  private assertPercentPoint({ x, y }: PercentCoordinates): void {
    const inRange = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;
    if (!inRange(x) || !inRange(y)) {
      throw new Error(
        `[Touch] percent values must be within 0–100. Received x=${x}, y=${y}`,
      );
    }
  }

  private toAbs(deviceKey: K, p: PercentCoordinates) {
    const axis = this.axes[deviceKey];
    if (!axis) {
      const known = Object.keys(this.axes as Record<string, unknown>);
      throw new Error(
        `[Touch] Unknown device key "${String(deviceKey)}". Known keys: ${known.join(", ") || "<none>"}`,
      );
    }
    this.assertPercentPoint(p);
    return axis.xy(p.x, p.y);
  }

  async tapAndRelease(deviceKey: K, point: PercentCoordinates): Promise<void> {
    const abs = this.toAbs(deviceKey, point);
    await this.client.post(`/finger`, {
      action: SpeculosActions.PRESS_AND_RELEASE,
      ...abs,
    });
  }

  async tap(deviceKey: K, point: PercentCoordinates): Promise<void> {
    const abs = this.toAbs(deviceKey, point);
    await this.client.post(`/finger`, {
      action: SpeculosActions.PRESS,
      ...abs,
    });
  }

  async release(deviceKey: K, point: PercentCoordinates): Promise<void> {
    const abs = this.toAbs(deviceKey, point);
    await this.client.post(`/finger`, {
      action: SpeculosActions.RELEASE,
      ...abs,
    });
  }
}
