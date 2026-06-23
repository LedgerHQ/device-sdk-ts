import { expect, type Page } from "@playwright/test";

export interface DeviceActionResult<Output> {
  status: string;
  output?: Output;
  error?: unknown;
}

const RESPONSE_ITEMS = '[data-testid="box_device-commands-responses"] > *';

/**
 * Drives the Device actions view: navigating to it, executing device actions
 * and reading back the emitted device-action states.
 */
export class DeviceActionsDriver {
  constructor(private readonly page: Page) {}

  /** Navigate Device actions -> Device actions list. */
  async goto(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/device-actions").click();
    await this.page.waitForURL("http://localhost:3000/device-actions", {
      timeout: 10_000,
    });
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Open the Wait for app and version action and Execute it.
   */
  async waitForAppAndVersion({
    unlockTimeout,
  }: { unlockTimeout?: number } = {}): Promise<void> {
    const commandButton = this.page.getByTestId(
      "CTA_command-Wait for app and version",
    );
    if (await commandButton.isVisible()) {
      await commandButton.click();
    }
    if (unlockTimeout !== undefined) {
      const input = this.page.locator("#unlockTimeout");
      await input.waitFor({ state: "visible" });
      await input.fill(String(unlockTimeout));
    }
    await this.page.getByTestId("CTA_send-device-action").click();
  }

  /**
   * Wait until the last emitted device-action state is pending with the given
   * required user interaction.
   */
  async expectRequiredUserInteraction(
    interaction: string,
    { timeout = 10_000 }: { timeout?: number } = {},
  ): Promise<void> {
    const last = this.page.locator(RESPONSE_ITEMS).last();
    await expect(last).toContainText(
      `"requiredUserInteraction": "${interaction}"`,
      { timeout },
    );
  }

  /**
   * Wait for the last emitted device-action state to be terminal and return it
   * parsed.
   */
  async lastResult<Output>({
    timeout = 90_000,
  }: { timeout?: number } = {}): Promise<DeviceActionResult<Output>> {
    const last = this.page.locator(RESPONSE_ITEMS).last();
    await expect(last).toContainText(
      /"status": "completed"|Device locked|DeviceLockedError/,
      { timeout },
    );

    const statusSpan = last.locator("span", { hasText: '"status"' });
    if ((await statusSpan.count()) > 0) {
      return JSON.parse(
        await statusSpan.last().innerText(),
      ) as DeviceActionResult<Output>;
    }

    return {
      status: "error",
      error: await last.innerText(),
    } as DeviceActionResult<Output>;
  }
}
