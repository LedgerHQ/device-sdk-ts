import { expect, type Page } from "@playwright/test";

import { ResponsesDriver } from "./ResponsesDriver";

export interface DeviceActionResult<Output> {
  status: string; // "completed" | "error" | "pending" | ...
  output?: Output;
  error?: unknown;
}

/**
 * Drives the Solana signer view: navigating to it, executing device actions and
 * reading back the emitted device-action states.
 */
export class SolSignerDriver {
  private readonly responses: ResponsesDriver;

  constructor(private readonly page: Page) {
    this.responses = new ResponsesDriver(page);
  }

  /** Navigate Signer Kits -> Solana. */
  async open(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/signers").click();
    await this.page.waitForURL("http://localhost:3000/signers");
    await this.page.getByTestId("CTA_command-Solana").click();
    await this.page.waitForURL("http://localhost:3000/signers/solana");
  }

  /**
   * Open the Get address action and Execute it. When `checkOnDevice` is set, the
   * address is verified on the device screen (the action stays pending until the
   * user approves on Speculos).
   */
  async getAddress({
    checkOnDevice = false,
  }: { checkOnDevice?: boolean } = {}): Promise<void> {
    await this.page.getByTestId("CTA_command-Get address").click();
    await this.setSwitch("checkOnDevice", checkOnDevice);
    await this.page.getByTestId("CTA_send-device-action").click();
  }

  /**
   * Open the Sign transaction action, fill the base64 serialized transaction
   * and Execute it. The action stays pending until the transaction is reviewed
   * and signed on Speculos.
   */
  async signTransaction(transaction: string): Promise<void> {
    await this.page.getByTestId("CTA_command-Sign transaction").click();
    const input = this.page.getByTestId("input-text_transaction");
    await input.waitFor({ state: "visible" });
    await input.fill(transaction);
    await this.page.getByTestId("CTA_send-device-action").click();
  }

  /**
   * Open the Sign off chain message action and Execute it with its default
   * inputs ("Hello World", V0). The action stays pending until the message is
   * reviewed and signed on Speculos.
   */
  async signOffChainMessage(): Promise<void> {
    await this.page.getByTestId("CTA_command-Sign off chain message").click();
    await this.page.getByTestId("CTA_send-device-action").click();
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
}
