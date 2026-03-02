import type { ButtonController } from "@internal/core/ButtonController";
import { type ButtonKey, type HttpClient, SpeculosActions } from "@internal/core/types";

export class DefaultButtonController implements ButtonController {
  constructor(private readonly client: HttpClient) {}

  async press(key: ButtonKey): Promise<void> {
    await this.client.post(`/button/${key}`, {
      action: SpeculosActions.PRESS_AND_RELEASE,
    });
  }
}
