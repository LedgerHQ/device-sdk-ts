import type { AxiosInstance } from "axios";
import { inject, injectable } from "inversify";

import type { ITouchController } from "@internal/core/ITouchController";
import type { Percent, PercentPoint } from "@internal/core/types";
import type { AxisMap } from "@internal/utils/axisClamp";
import { speculosDeviceControllerTypes } from "@root/src/internal/core/speculosDeviceControllerTypes";

@injectable()
export class AxiosTouchController implements ITouchController<string> {
  constructor(
    @inject(speculosDeviceControllerTypes.HttpClient)
    private readonly client: AxiosInstance,
    @inject(speculosDeviceControllerTypes.Axes)
    private readonly axes: AxisMap<string>,
  ) {}

  private assertPercentPoint({ x, y }: PercentPoint): void {
    const inRange = (v: number) => Number.isFinite(v) && v >= 0 && v <= 100;
    if (!inRange(x) || !inRange(y)) {
      throw new Error(
        `[Touch] percent values must be within 0–100. Received x=${x}, y=${y}`,
      );
    }
  }

  private toAbs(deviceKey: string, p: PercentPoint) {
    const axis = this.axes[deviceKey];
    if (!axis) {
      const known = Object.keys(this.axes);
      throw new Error(
        `[Touch] Unknown device key "${deviceKey}". Known keys: ${known.join(", ") || "<none>"}`,
      );
    }

    this.assertPercentPoint(p);

    return axis.xy(p.x as Percent, p.y as Percent);
  }

  async tapAndRelease(deviceKey: string, point: PercentPoint): Promise<void> {
    const abs = this.toAbs(deviceKey, point);
    await this.client.post(`/finger`, {
      action: "press-and-release",
      ...abs,
    });
  }

  async tap(deviceKey: string, point: PercentPoint): Promise<void> {
    const abs = this.toAbs(deviceKey, point);
    await this.client.post(`/finger`, {
      action: "press",
      ...abs,
    });
  }

  async release(deviceKey: string, point: PercentPoint): Promise<void> {
    const abs = this.toAbs(deviceKey, point);
    await this.client.post(`/finger`, {
      action: "release",
      ...abs,
    });
  }
}
