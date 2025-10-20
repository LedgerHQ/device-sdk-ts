import type { AxiosInstance } from "axios";

import type { IButtonController } from "@internal/core/IButtonController";
import { type ButtonKey, SpeculosActions } from "@internal/core/types";

export class AxiosButtonController implements IButtonController {
  constructor(private readonly client: AxiosInstance) {}

  async press(key: ButtonKey): Promise<void> {
    await this.client.post(`/button/${key}`, {
      action: SpeculosActions.PRESS_AND_RELEASE,
    });
  }
}
