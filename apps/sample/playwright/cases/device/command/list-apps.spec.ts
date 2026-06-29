/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, test } from "../../../fixtures";

// The List Apps command lists the installed apps over a plain APDU
// (0xE0 0xDE) — no secure channel and no Manager API. The mock derives the
// response from the device's installed apps (BOLOS is excluded as the
// dashboard), so the device must be seeded with at least one regular app.
const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  apps: [
    { name: "BOLOS", version: "1.5.0" },
    { name: "Bitcoin", version: "2.1.0" },
  ],
  masks: [0x33000000],
};

interface ListAppsResponse {
  status: string;
  data?: { appName: string }[];
}

test.describe("device command: list apps", () => {
  test("lists the installed apps without the secure channel", async ({
    device,
    commands,
  }) => {
    await test.step("Given a connected device with Bitcoin installed", async () => {
      await device.addAndConnect(NANO_X);
    });

    await test.step("When the List Apps command is executed", async () => {
      await commands.goto();
      await commands.execute("List Apps");
    });

    await test.step("Then it succeeds and returns the installed apps", async () => {
      const response = await commands.lastResponse<ListAppsResponse>();
      expect(response.status).toBe("SUCCESS");
      expect(response.data?.map((app) => app.appName)).toEqual(["Bitcoin"]);
    });
  });
});
