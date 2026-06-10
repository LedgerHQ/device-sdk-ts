import { type MockClient } from "@ledgerhq/device-mockserver-client";
import { deviceControllerClientFactory } from "@ledgerhq/speculos-device-controller";

type DeviceControllerClient = ReturnType<typeof deviceControllerClientFactory>;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Drives the live Speculos emulator backing a device (screen + buttons).
 *
 * The emulator URL is discovered through the mock server
 * (`GET /devices/:id/speculos`); control then targets the emulator directly via
 * `@ledgerhq/speculos-device-controller` (which knows the per-model screen
 * coordinates). The mock server also exposes an authenticated control proxy at
 * `/devices/:id/speculos/*`, but the controller cannot carry the bearer token,
 * so the driver talks to the emulator URL the GET endpoint returns.
 */
export class SpeculosDriver {
  private controller?: DeviceControllerClient;
  private model = "";

  constructor(
    private readonly client: MockClient,
    private readonly deviceId: string,
  ) {}

  /**
   * Wait until the device's Speculos instance is provisioned (opening an app is
   * slow), then build the controller against the emulator URL.
   */
  async waitReady({
    timeoutMs = 90_000,
    intervalMs = 1_000,
  }: { timeoutMs?: number; intervalMs?: number } = {}): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      try {
        const instance = await this.client.getSpeculos(this.deviceId);
        this.controller = deviceControllerClientFactory(instance.speculos_url);
        this.model = instance.model.toLowerCase();
        return;
      } catch (error) {
        if (Date.now() >= deadline) {
          throw new Error(
            `Speculos instance for ${this.deviceId} not ready within timeout: ${String(error)}`,
          );
        }
        await sleep(intervalMs);
      }
    }
  }

  /** Low-level button controller (Nano). */
  buttons() {
    return this.ready().buttonFactory();
  }

  /** Low-level touch controller (Stax / Flex). */
  touch() {
    return this.ready().tapFactory(this.model);
  }

  /**
   * Approve the screen currently displayed (e.g. confirm an address or sign a
   * transaction). Touch devices tap the sign control; Nano devices confirm with
   * both buttons.
   */
  async approve(): Promise<void> {
    if (this.model === "stax" || this.model === "flex") {
      await this.touch().sign();
    } else {
      await this.buttons().both();
    }
  }

  private ready(): DeviceControllerClient {
    if (!this.controller) {
      throw new Error("SpeculosDriver not ready — call waitReady() first");
    }
    return this.controller;
  }
}
