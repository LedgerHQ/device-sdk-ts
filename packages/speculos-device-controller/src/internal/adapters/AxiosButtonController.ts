import type { AxiosInstance } from "axios";
import { inject, injectable } from "inversify";

import type { IButtonController } from "@internal/core/IButtonController";
import type { ButtonKey } from "@internal/core/types";
import { speculosDeviceControllerTypes } from "@root/src/internal/core/speculosDeviceControllerTypes";

@injectable()
export class AxiosButtonController implements IButtonController {
  constructor(
    @inject(speculosDeviceControllerTypes.HttpClient)
    private readonly client: AxiosInstance,
  ) {}

  private toEndpointKey(but: ButtonKey): "left" | "right" | "both" {
    const map: Record<ButtonKey, "left" | "right" | "both"> = {
      Ll: "left",
      Rr: "right",
      LRlr: "both",
      left: "left",
      right: "right",
      both: "both",
    };
    return map[but];
  }

  async press(but: ButtonKey): Promise<void> {
    const input = this.toEndpointKey(but);
    await this.client.post(`/button/${input}`, { action: "press-and-release" });
  }
}
