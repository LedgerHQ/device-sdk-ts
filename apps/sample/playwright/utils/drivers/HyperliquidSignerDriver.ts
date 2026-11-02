import { type Page } from "@playwright/test";

import { ResponsesDriver } from "./ResponsesDriver";

export interface DeviceActionResult<Output> {
  status: string; // "completed" | "error" | "pending" | ...
  output?: Output;
  error?: unknown;
}

/**
 * Drives the Hyperliquid signer view: navigating to it, executing device actions and
 * reading back the emitted device-action states.
 */
export class HyperliquidSignerDriver {
  private readonly responses: ResponsesDriver;

  constructor(private readonly page: Page) {
    this.responses = new ResponsesDriver(page);
  }

  /** Navigate Signer Kits -> Hyperliquid. */
  async open(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/signers").click();
    await this.page.waitForURL("http://localhost:3000/signers");
    await this.page.getByTestId("CTA_command-Hyperliquid").click();
    await this.page.waitForURL("http://localhost:3000/signers/hyperliquid");
  }

  /**
   * Open the Sign Actions action and Execute it with its default inputs (an ETH
   * market order and its certificate). The action stays pending until the
   * actions are reviewed and signed on the device screen.
   */
  async signActions(): Promise<void> {
    await this.page.getByTestId("CTA_command-Sign Actions").click();
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
