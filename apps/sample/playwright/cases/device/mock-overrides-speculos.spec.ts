/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../fixtures";

// Stax with the Ethereum app installed - the known-good combo provisioned via
// Speculinho in open-app.spec.ts.
const STAX_ETH: DeviceConfig = {
  name: "Ledger Stax",
  device_type: "stax",
  connectivity_type: "USB",
  firmware_version: "1.9.1",
  apps: [
    { name: "BOLOS", version: "1.9.1" },
    { name: "Ethereum", version: "1.22.0" },
  ],
  masks: [0x33200000],
};

// GetAppAndVersion APDU polled by the device-session refresher.
const GET_APP_AND_VERSION_PREFIX = "b0010000";
// "Device is locked" status word.
const LOCKED_RESPONSE = "5515";

interface OpenAppResponse {
  status: string;
}

interface GetAppAndVersionResponse {
  status: string;
  data?: { name: string; version: string };
  error?: { _tag: string; errorCode: string; message: string };
}

test.describe("device: explicit mock overrides the live Speculos proxy", () => {
  test("locks the device by mocking GetAppAndVersion while Ethereum is open", async ({
    device,
    commands,
    mockClient,
    sidebar,
  }) => {
    // Opening an installed app provisions a real Speculos instance, which can
    // take a while to become ready.
    test.setTimeout(120_000);

    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given a connected Stax with the Ethereum app", async () => {
      dev = await device.addAndConnect(STAX_ETH);
    });

    await test.step("When the Ethereum app is opened (Speculos proxy active)", async () => {
      await commands.goto();
      await commands.execute("Open app", {
        inputField: "input-text_appName",
        inputValue: "Ethereum",
      });
      const response = await commands.lastResponse<OpenAppResponse>({
        timeout: 90_000,
      });
      expect(response.status).toBe("SUCCESS");
    });

    await test.step("Then the device is CONNECTED (GetAppAndVersion forwarded to the emulator)", async () => {
      await sidebar.expectStatus("CONNECTED");
    });

    await test.step("When GetAppAndVersion is mocked to 5515 over the active proxy", async () => {
      // The explicit mock must take precedence over the Speculos proxy: the next
      // refresher poll should see 5515 rather than the emulator's response.
      await mockClient.addMock(dev.id, {
        prefix: GET_APP_AND_VERSION_PREFIX,
        response: LOCKED_RESPONSE,
      });
    });

    await test.step("Then the device status becomes LOCKED", async () => {
      await sidebar.expectStatus("LOCKED");
    });

    await test.step("And Get app and version reports the device is locked (5515)", async () => {
      // Close the Open app drawer first, then run Get app and version in its own
      // drawer. The mock takes precedence over the live proxy, so the command
      // sees 5515 and surfaces it as a DeviceLockedError, not the emulator's app.
      await commands.closeDrawer();
      await commands.execute("Get app and version");
      await commands.waitForResponseCount(1);
      const response = await commands.lastResponse<GetAppAndVersionResponse>();

      expect(response.status).toBe("ERROR");
      expect(response.error).toMatchObject({
        _tag: "DeviceLockedError",
        errorCode: "5515",
        message: "Device is locked.",
      });
    });
  });
});
