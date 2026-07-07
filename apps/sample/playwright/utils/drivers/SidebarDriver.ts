import { expect, type Page } from "@playwright/test";

/**
 * Drives the left sidebar ("Device sessions" panel), which shows the connected
 * device and its live session status (CONNECTED / BUSY / LOCKED / NOT CONNECTED).
 */
export class SidebarDriver {
  constructor(private readonly page: Page) {}

  /**
   * Assert the (first) device session status text. The text is the
   * `DeviceStatus` enum value, e.g. "CONNECTED" or "LOCKED".
   */
  async expectStatus(
    status: string,
    { timeout = 15_000 }: { timeout?: number } = {},
  ): Promise<void> {
    await expect(
      this.page.getByTestId("text_device-connection-status").first(),
    ).toContainText(status, { timeout });
  }
}
