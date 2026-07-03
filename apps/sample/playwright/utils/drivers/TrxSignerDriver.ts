import { type Page } from "@playwright/test";

import { ResponsesDriver } from "./ResponsesDriver";

export interface DeviceActionResult<Output> {
  status: string; // "completed" | "error" | "pending" | ...
  output?: Output;
  error?: unknown;
}

/**
 * Drives the Tron signer view: navigating to it, executing device actions and
 * reading back the emitted device-action states.
 */
export class TrxSignerDriver {
  private readonly responses: ResponsesDriver;

  constructor(private readonly page: Page) {
    this.responses = new ResponsesDriver(page);
  }

  /** Navigate Signer Kits -> Tron. */
  async open(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/signers").click();
    await this.page.waitForURL("http://localhost:3000/signers");
    await this.page.getByTestId("CTA_command-Tron").click();
    await this.page.waitForURL("http://localhost:3000/signers/tron");
    await this.page.waitForLoadState("networkidle");
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
    if (checkOnDevice) {
      await this.page.getByTestId("input-switch_checkOnDevice").click();
    }
    await this.page.getByTestId("CTA_send-device-action").click();
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
