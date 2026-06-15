import { type Page } from "@playwright/test";

import { ResponsesDriver } from "./ResponsesDriver";

export type DeviceCommandParams = {
  inputField?: string;
  inputValue?: string;
};

/**
 * Drives the Commands view: navigating to it, executing device commands and
 * reading back the rendered responses.
 */
export class CommandsDriver {
  private readonly responses: ResponsesDriver;

  constructor(private readonly page: Page) {
    this.responses = new ResponsesDriver(page);
  }

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

  /**
   * Dismiss the currently-open command drawer. Each command renders its own
   * drawer (a full-viewport modal that unmounts on close), so the drawer must be
   * closed before another command's list item can be reached. The react-ui
   * Drawer closes on a backdrop click; the panel is right-aligned, leaving the
   * left of the viewport as backdrop.
   */
  async closeDrawer(): Promise<void> {
    const drawer = this.page.getByTestId("CTA_send-device-command");
    if ((await drawer.count()) === 0) return;
    await this.page.mouse.click(40, 360);
    await drawer.first().waitFor({ state: "detached" });
  }

  /** Click Send on the currently open command drawer. */
  async send(): Promise<void> {
    await this.page.getByTestId("CTA_send-device-command").click();
  }

  /** Wait until the responses list holds exactly `count` entries. */
  async waitForResponseCount(count: number): Promise<void> {
    await this.responses.waitForCount(count);
  }

  /**
   * Wait for the last response to settle (its JSON contains "status") and return
   * it parsed.
   */
  async lastResponse<T>({
    timeout = 30_000,
  }: { timeout?: number } = {}): Promise<T> {
    return this.responses.lastJson<T>('"status"', { timeout });
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
