import { expect, type Page } from "@playwright/test";

import { getLastDeviceResponseContent } from "../utils";

export type DeviceCommandParams = {
  inputField?: string;
  inputValue?: string;
};

const RESPONSE_ITEMS = '[data-testid="box_device-commands-responses"] > *';

/**
 * Drives the Commands view: navigating to it, executing device commands and
 * reading back the rendered responses.
 */
export class CommandsDriver {
  constructor(private readonly page: Page) {}

  /** Navigate to the /commands route. */
  async goto(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/commands").click();
    await this.page.waitForURL("http://localhost:3000/commands", {
      timeout: 10_000,
    });
    await this.page.waitForLoadState("networkidle");
  }

  /** Open the command drawer, fill its inputs and click Send. */
  async execute(
    command: string,
    params: DeviceCommandParams | DeviceCommandParams[] = [],
  ): Promise<void> {
    await this.open(command);
    await this.fillInputs(params);
    await this.send();
  }

  /** Open a command drawer without sending it. */
  async open(command: string): Promise<void> {
    await this.page.getByTestId(`CTA_command-${command}`).click();
  }

  /** Click Send on the currently open command drawer. */
  async send(): Promise<void> {
    await this.page.getByTestId("CTA_send-device-command").click();
  }

  /** Wait until the responses list holds exactly `count` entries. */
  async waitForResponseCount(count: number): Promise<void> {
    await expect
      .poll(() => this.page.locator(RESPONSE_ITEMS).count())
      .toBe(count);
  }

  /**
   * Wait for the last response to settle (its JSON contains "status") and return
   * it parsed.
   */
  async lastResponse<T>({
    timeout = 30_000,
  }: { timeout?: number } = {}): Promise<T> {
    await expect(this.page.locator(RESPONSE_ITEMS).last()).toContainText(
      '"status"',
      { timeout },
    );
    return (await getLastDeviceResponseContent(this.page, "span")) as T;
  }

  private async fillInputs(
    params: DeviceCommandParams | DeviceCommandParams[],
  ): Promise<void> {
    const list = Array.isArray(params) ? params : [params];
    for (const { inputField, inputValue } of list) {
      if (inputField && inputValue) {
        const input = this.page.getByTestId(inputField);
        await input.waitFor({ state: "visible" });
        await input.fill(inputValue);
      }
    }
  }
}
