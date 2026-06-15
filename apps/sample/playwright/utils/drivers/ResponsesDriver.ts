import { expect, type Page } from "@playwright/test";

const RESPONSE_ITEMS = '[data-testid="box_device-commands-responses"] > *';

/**
 * Reads the device command / device action responses box, shared by the
 * Commands and Ethereum signer drivers (both render into the same box).
 */
export class ResponsesDriver {
  constructor(private readonly page: Page) {}

  /** Number of rendered response items. */
  count(): Promise<number> {
    return this.page.locator(RESPONSE_ITEMS).count();
  }

  /** Wait until exactly `count` response items are rendered. */
  async waitForCount(count: number): Promise<void> {
    await expect
      .poll(() => this.page.locator(RESPONSE_ITEMS).count())
      .toBe(count);
  }

  /**
   * Wait until the last response contains `until` (its terminal marker), then
   * return it parsed as JSON. The rendered response JSON lives in a descendant
   * `<span>` containing the `"status"` field.
   */
  async lastJson<T>(
    until: string | RegExp,
    { timeout = 30_000 }: { timeout?: number } = {},
  ): Promise<T> {
    const last = this.page.locator(RESPONSE_ITEMS).last();
    await expect(last).toContainText(until, { timeout });
    const body = last.locator("span", { hasText: '"status"' }).last();
    return JSON.parse(await body.innerText()) as T;
  }
}
