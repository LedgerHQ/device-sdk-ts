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

  async press(key: ButtonKey): Promise<void> {
    await this.client.post(`/button/${key}`, { action: "press-and-release" });
  }
}
