import { expect, type Page } from "@playwright/test";

import { ResponsesDriver } from "./ResponsesDriver";

export interface DeviceActionResult<Output> {
  status: string; // "completed" | "error" | "pending" | ...
  output?: Output;
  error?: unknown;
}

/**
 * Drives the XRP signer view: navigating to it, executing device actions and
 * reading back the emitted device-action states.
 */
export class XrpSignerDriver {
  private readonly responses: ResponsesDriver;

  constructor(private readonly page: Page) {
    this.responses = new ResponsesDriver(page);
  }

  /** Navigate Signer Kits -> Xrp. */
  async open(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/signers").click();
    await this.page.waitForURL("http://localhost:3000/signers");
    await this.page.getByTestId("CTA_command-Xrp").click();
    await this.page.waitForURL("http://localhost:3000/signers/xrp");
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Open the Get App Config action and Execute it. With `skipOpenApp` the
   * command is sent straight to the device, without opening the XRP app first.
   */
  async getAppConfig({
    skipOpenApp = false,
  }: { skipOpenApp?: boolean } = {}): Promise<void> {
    await this.page.getByTestId("CTA_command-Get App Config").click();
    await this.setSwitch("skipOpenApp", skipOpenApp);
    await this.page.getByTestId("CTA_send-device-action").click();
  }

  /** Open the Get Address action and Execute it. */
  async getAddress({
    derivationPath,
    checkOnDevice = false,
    returnChainCode = false,
    skipOpenApp = false,
  }: {
    derivationPath?: string;
    checkOnDevice?: boolean;
    returnChainCode?: boolean;
    skipOpenApp?: boolean;
  } = {}): Promise<void> {
    await this.page.getByTestId("CTA_command-Get Address").click();
    if (derivationPath !== undefined) {
      const input = this.page.getByTestId("input-text_derivationPath");
      await input.waitFor({ state: "visible" });
      await input.fill(derivationPath);
    }
    await this.setSwitch("checkOnDevice", checkOnDevice);
    await this.setSwitch("returnChainCode", returnChainCode);
    await this.setSwitch("skipOpenApp", skipOpenApp);
    await this.page.getByTestId("CTA_send-device-action").click();
  }

  /**
   * Set a boolean form field to `checked`.
   *
   * The `input-switch_*` test id sits on a wrapper around the switch, and
   * clicking that wrapper does not toggle it — the click has to land on the
   * inner `role="button"` element. The state is read back from the underlying
   * checkbox so the toggle is idempotent and a silently ignored click fails
   * here rather than further down the test.
   */
  private async setSwitch(fieldKey: string, checked: boolean): Promise<void> {
    const field = this.page.getByTestId(`input-switch_${fieldKey}`);
    const checkbox = field.locator('input[type="checkbox"]');
    await checkbox.waitFor({ state: "attached" });
    if ((await checkbox.isChecked()) !== checked) {
      await field.locator('[role="button"]').click();
    }
    await expect(checkbox).toBeChecked({ checked });
  }

  /**
   * Wait for the last emitted device-action state to be terminal and return it
   * parsed.
   */
  async lastResult<Output>({
    timeout = 90_000,
  }: { timeout?: number } = {}): Promise<DeviceActionResult<Output>> {
    return this.responses.lastJson<DeviceActionResult<Output>>(
      /"status": "(completed|error)"/,
      { timeout },
    );
  }

  /**
   * Wait for the device action to fail and return the rendered error text.
   *
   * An errored device action is dumped with `util.inspect`, so it has no JSON
   * body to parse — the caller asserts on the tag, status word and message.
   */
  async lastError({
    timeout = 90_000,
  }: { timeout?: number } = {}): Promise<string> {
    return this.responses.lastText(/_tag: '/, { timeout });
  }
}
