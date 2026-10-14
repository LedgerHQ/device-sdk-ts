import { expect, type Page } from "@playwright/test";

import { ResponsesDriver } from "./ResponsesDriver";

export interface DeviceActionResult<Output> {
  status: string; // "completed" | "error" | "pending" | ...
  output?: Output;
  error?: unknown;
}

/** Labels of the address format options in the Get Address form. */
export type AddressFormatLabel = "Legacy" | "P2SH" | "Bech32";

/**
 * Drives the Litecoin signer view (signer-btc-legacy with the Litecoin
 * profile): navigating to it, executing device actions and reading back the
 * emitted device-action states.
 */
export class LtcSignerDriver {
  private readonly responses: ResponsesDriver;

  constructor(private readonly page: Page) {
    this.responses = new ResponsesDriver(page);
  }

  /** Navigate Signer Kits -> Litecoin. */
  async open(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/signers").click();
    await this.page.waitForURL("http://localhost:3000/signers");
    await this.page.getByTestId("CTA_command-Litecoin").click();
    await this.page.waitForURL("http://localhost:3000/signers/litecoin");
  }

  /** Open the Get Address action, fill its form and Execute it. */
  async getAddress({
    derivationPath,
    addressFormat,
    checkOnDevice = false,
  }: {
    derivationPath?: string;
    addressFormat?: AddressFormatLabel;
    checkOnDevice?: boolean;
  } = {}): Promise<void> {
    await this.page.getByTestId("CTA_command-Get Address").click();
    if (derivationPath !== undefined) {
      const input = this.page.getByTestId("input-text_derivationPath");
      await input.waitFor({ state: "visible" });
      await input.fill(derivationPath);
    }
    if (addressFormat !== undefined) {
      await this.selectOption(addressFormat);
    }
    await this.setSwitch("checkOnDevice", checkOnDevice);
    await this.page.getByTestId("CTA_send-device-action").click();
  }

  /** Pick an option of the form's only select input. */
  private async selectOption(optionLabel: string): Promise<void> {
    const form = this.page.getByTestId("form_device-action");
    await form.locator('[class*="control"]').first().click();
    await this.page.getByRole("option", { name: optionLabel }).click();
  }

  /**
   * Set a boolean form field to `checked`. The click has to land on the inner
   * `role="button"` of the `input-switch_*` wrapper, and the state is read back
   * from the checkbox so the toggle is idempotent.
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
   * Wait for the device action to fail and return the rendered error text
   * (errored device actions are dumped with `util.inspect`, not as JSON).
   */
  async lastError({
    timeout = 90_000,
  }: { timeout?: number } = {}): Promise<string> {
    return this.responses.lastText(/_tag: '/, { timeout });
  }
}
