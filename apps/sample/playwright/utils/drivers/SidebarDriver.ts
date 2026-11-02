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

  /** Select the device session whose card shows the given device name. */
  async selectSession(name: string): Promise<void> {
    await this.page
      .getByTestId("text_device-name")
      .filter({ hasText: name })
      .first()
      .click();
  }

  /** Disconnect the (first) device session from its options dropdown. */
  async disconnect(): Promise<void> {
    await this.page.getByTestId("dropdown_device-option").first().click();
    await this.page.getByTestId("CTA_disconnect-device").first().click();
  }

  /**
   * Reconnect the (first) device session from its options dropdown, and wait
   * for its card to be replaced by the card of the new session.
   */
  async reconnect(): Promise<void> {
    await this.page
      .getByTestId("text_device-name")
      .first()
      .evaluate((name) => name.setAttribute("data-old-session", ""));
    await this.page.getByTestId("dropdown_device-option").first().click();
    await this.page.getByTestId("CTA_reconnect-device").first().click();
    await expect(this.page.locator("[data-old-session]")).toHaveCount(0, {
      timeout: 15_000,
    });
  }

  /** Assert the number of listed device sessions. */
  async expectSessionCount(count: number): Promise<void> {
    await expect(this.page.getByTestId("text_device-name")).toHaveCount(count, {
      timeout: 15_000,
    });
  }

  /** Assert no device session is listed anymore. */
  async expectNoSession(): Promise<void> {
    await this.expectSessionCount(0);
  }

  /** Assert the mock session card shows an active session. */
  async expectActiveMockSession(): Promise<void> {
    await expect(this.page.getByTestId("card_mock-session")).toContainText(
      "min left",
      { timeout: 15_000 },
    );
  }

  /** Copy the session token from the mock session card and return the clipboard. */
  async copyMockSessionToken(): Promise<string> {
    const copy = this.page.getByTestId("CTA_copy-mock-session-token");
    await copy.click();
    await expect(copy).toHaveText("Copied");
    return this.page.evaluate(() => navigator.clipboard.readText());
  }

  /** Open the Mock Server UI from the mock session card and return its tab. */
  async openMockServerUi(): Promise<Page> {
    const [tab] = await Promise.all([
      this.page.context().waitForEvent("page"),
      this.page.getByTestId("CTA_open-mock-server-ui").click(),
    ]);
    await tab.waitForLoadState();
    return tab;
  }
}
