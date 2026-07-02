/* eslint-disable no-restricted-imports */
import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { test } from "../../fixtures";

const NANO_X: DeviceConfig = {
  name: "Ledger Nano X",
  device_type: "nanoX",
  connectivity_type: "USB",
  firmware_version: "2.2.3",
  masks: [0x33000000],
};

// GetAppAndVersion APDU polled by the device-session refresher.
const GET_APP_AND_VERSION_PREFIX = "b0010000";
// "Device is locked" status word.
const LOCKED_RESPONSE = "5515";

test.describe("device status: locked", () => {
  // This test exercises the refresher polling GetAppAndVersion, so polling must
  // be enabled (overrides the default disablePolling: true fixture).
  test.use({ disablePolling: false });

  test("reports LOCKED on 5515 and CONNECTED again once cleared", async ({
    device,
    mockClient,
    sidebar,
  }) => {
    let dev!: Awaited<ReturnType<typeof device.addAndConnect>>;
    await test.step("Given a connected device", async () => {
      dev = await device.addAndConnect(NANO_X);
    });

    let lockMockId = "";
    await test.step("When GetAppAndVersion starts returning 5515", async () => {
      // The refresher polls GetAppAndVersion (~1s); this explicit mock overrides
      // the derived handshake so the next poll reports the device as locked.
      const mock = await mockClient.addMock(dev.id, {
        prefix: GET_APP_AND_VERSION_PREFIX,
        response: LOCKED_RESPONSE,
      });
      lockMockId = mock.id;
    });

    await test.step("Then the device status becomes LOCKED", async () => {
      await sidebar.expectStatus("LOCKED");
    });

    await test.step("When the 5515 mock is removed", async () => {
      // GetAppAndVersion falls back to the derived handshake (no longer 5515).
      await mockClient.deleteMock(dev.id, lockMockId);
    });

    await test.step("Then the device status returns to CONNECTED", async () => {
      await sidebar.expectStatus("CONNECTED");
    });
  });
});
