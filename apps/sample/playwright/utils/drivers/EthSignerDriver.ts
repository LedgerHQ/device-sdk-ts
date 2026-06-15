import { type Page } from "@playwright/test";

import { ResponsesDriver } from "./ResponsesDriver";

export interface DeviceActionResult<Output> {
  status: string; // "completed" | "error" | "pending" | ...
  output?: Output;
  error?: unknown;
}

/**
 * Drives the Ethereum signer view: navigating to it, executing device actions
 * and reading back the emitted device-action states.
 */
export class EthSignerDriver {
  private readonly responses: ResponsesDriver;

  constructor(private readonly page: Page) {
    this.responses = new ResponsesDriver(page);
  }

  /** Navigate Signer Kits -> Ethereum. */
  async open(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/signers").click();
    await this.page.waitForURL("http://localhost:3000/signers");
    await this.page.getByTestId("CTA_command-Ethereum").click();
    await this.page.waitForURL("http://localhost:3000/signers/ethereum");
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
   * Open the Sign transaction action, fill the transaction (JSON or serialized
   * raw tx) and Execute it. The action opens the Ethereum app and then waits for
   * the transaction to be reviewed and approved on the device screen.
   */
  async signTransaction(
    transaction: string,
    { skipOpenApp = false }: { skipOpenApp?: boolean } = {},
  ): Promise<void> {
    await this.page.getByTestId("CTA_command-Sign transaction").click();
    const input = this.page.getByTestId("input-text_transaction");
    await input.waitFor({ state: "visible" });
    await input.fill(transaction);
    if (skipOpenApp) {
      await this.page.getByTestId("input-switch_skipOpenApp").click();
    }
    await this.page.getByTestId("CTA_send-device-action").click();
  }

  /**
   * Open the Sign typed message action, fill the EIP-712 JSON message and
   * Execute it. The action opens the Ethereum app and then waits for the message
   * to be reviewed and approved on the device screen.
   */
  async signTypedMessage(
    message: string,
    { skipOpenApp = false }: { skipOpenApp?: boolean } = {},
  ): Promise<void> {
    await this.page.getByTestId("CTA_command-Sign typed message").click();
    const input = this.page.getByTestId("input-text_message");
    await input.waitFor({ state: "visible" });
    await input.fill(message);
    if (skipOpenApp) {
      await this.page.getByTestId("input-switch_skipOpenApp").click();
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
