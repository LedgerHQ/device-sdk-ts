/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";
import { type Page } from "@playwright/test";

import { expect, test } from "../../fixtures";
import { type SpeculosDriver } from "../../utils/drivers/SpeculosDriver";

// Nano X with Bitcoin - the combo provisioned via Speculinho in open-app.spec.
const NANO_X_BTC: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.7.1",
  apps: [
    { name: "BOLOS", version: "2.7.1" },
    { name: "Bitcoin", version: "2.4.6" },
  ],
  masks: [0x33000000],
};

/** Menu entries between the app home screen and its "Quit" entry. */
const QUIT_MAX_STEPS = 8;
/** Time for the emulator to render the next menu entry after a press. */
const MENU_STEP_MS = 700;
/** Confirmations to send on the "Quit" entry before giving up. */
const QUIT_CONFIRM_ATTEMPTS = 3;
/** Time for the app to exit after a confirmation. It normally goes in under a second. */
const QUIT_EXIT_TIMEOUT_MS = 10_000;
const QUIT_EXIT_POLL_MS = 500;

interface CommandResponse {
  status: string;
  data?: { name: string; version: string };
}

/**
 * Confirm on the "Quit" entry until the app exits, which the emulator reports by
 * having no screen left to serve. The emulator accepts the press (the proxy
 * answers 200) but acts on it only some of the time, and nothing else drives the
 * device, so the entry stays on screen until it is pressed again.
 */
async function confirmQuit(
  page: Page,
  emulator: SpeculosDriver,
): Promise<void> {
  for (let attempt = 0; attempt < QUIT_CONFIRM_ATTEMPTS; attempt += 1) {
    await page.getByTestId("button_device-screen-both").click();
    const deadline = Date.now() + QUIT_EXIT_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const screen = (await emulator.currentScreen()).toLowerCase();
      if (!screen.includes("quit")) return;
      await page.waitForTimeout(QUIT_EXIT_POLL_MS);
    }
  }
  throw new Error("The app stayed on its Quit entry after confirming");
}

/**
 * Quit the running app the way a user does: page through its menu on the docked
 * device screen and confirm on "Quit". The buttons are the sample's own, so the
 * presses travel through the mock server's Speculos proxy.
 */
async function quitAppFromDeviceScreen(
  page: Page,
  emulator: SpeculosDriver,
): Promise<void> {
  for (let step = 0; step < QUIT_MAX_STEPS; step += 1) {
    const screen = (await emulator.currentScreen()).toLowerCase();
    if (screen.includes("quit")) {
      await confirmQuit(page, emulator);
      return;
    }
    await page.getByTestId("button_device-screen-right").click();
    await page.waitForTimeout(MENU_STEP_MS);
  }
  throw new Error("Never reached the app's Quit entry");
}

test.describe("device: quitting an app from the device screen", () => {
  test("reverts the mock server to BOLOS mode", async ({
    page,
    device,
    commands,
    mockClient,
    speculos,
  }) => {
    // Opening an installed app provisions a real Speculos instance, which can
    // take a while to become ready.
    test.setTimeout(180_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given a connected Nano X with the Bitcoin app", async () => {
      dev = await device.addAndConnect(NANO_X_BTC);
    });

    let emulator!: SpeculosDriver;
    await test.step("And the Bitcoin app is opened (Speculos proxy active)", async () => {
      await commands.goto();
      await commands.execute("Open app", {
        inputField: "input-text_appName",
        inputValue: "Bitcoin",
      });
      const response = await commands.lastResponse<CommandResponse>({
        timeout: 90_000,
      });
      expect(response.status).toBe("SUCCESS");

      emulator = speculos(dev);
      await emulator.waitReady();
      await emulator.waitForAnyScreen();
      // The drawer covers the sidebar the device screen is docked in.
      await commands.closeDrawer();
      await expect(page.getByTestId("image_device-screen")).toBeVisible();
    });

    await test.step("When the app is quit from the device screen", async () => {
      await quitAppFromDeviceScreen(page, emulator);
    });

    await test.step("Then the emulator is released and the device screen falls back to the device record", async () => {
      // Speculos exits with the app, so the screen the panel polls is gone: it
      // shows the mock server's own record of the device instead.
      await expect(page.getByTestId("container_device-os-info")).toBeVisible({
        timeout: 60_000,
      });
      await expect
        .poll(
          async () => {
            try {
              await mockClient.getSpeculos(dev.id);
              return "live";
            } catch {
              return "released";
            }
          },
          { timeout: 30_000 },
        )
        .toBe("released");
    });

    await test.step("And the mock server answers Get app and version with BOLOS", async () => {
      await commands.execute("Get app and version");
      await commands.waitForResponseCount(1);
      const response = await commands.lastResponse<CommandResponse>();
      expect(response.status).toBe("SUCCESS");
      expect(response.data).toMatchObject({
        name: "BOLOS",
        version: NANO_X_BTC.firmware_version!,
      });
    });
  });
});
