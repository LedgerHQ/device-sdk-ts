import type { AxiosInstance } from "axios";

import type { ButtonController } from "@internal/core/ButtonController";
import { type ButtonKey, SpeculosActions } from "@internal/core/types";

export class DefaultButtonController implements ButtonController {
  constructor(private readonly client: AxiosInstance) {}

  async press(key: ButtonKey): Promise<void> {
    await this.client.post(`/button/${key}`, {
      action: SpeculosActions.PRESS_AND_RELEASE,
    });
  }
}
