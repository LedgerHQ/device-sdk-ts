/* eslint-disable no-restricted-imports */
import fs from "node:fs";

import { type DeviceConfig } from "@ledgerhq/device-mockserver-client";

import { expect, NANO_X, test } from "./fixtures";

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

test.describe("devtools: inspector", () => {
  test.beforeEach(async ({ devtools, connectDevice }) => {
    await connectDevice();
    await devtools.open("Inspector");
    await expect(devtools.sessionsTitle(1)).toBeVisible();
  });

  test("shows the connected session", async ({ devtools }) => {
    await expect(
      devtools.page.getByRole("heading", { name: "Ledger Nano X" }),
    ).toBeVisible();
    await expect(devtools.sessionDetail("Model")).toHaveText("nanoX");
    await expect(devtools.sessionDetail("Current app")).toHaveText(
      /BOLOS\s*2\.4\.0/,
    );
    await expect(devtools.sessionDetail("Session ID")).toHaveText(
      /^[0-9a-f-]{36}$/,
    );
  });

  test("sends the quick APDUs and lists them by command name", async ({
    devtools,
  }) => {
    await devtools.button("Get OS version").click();
    await expect(devtools.apduRows(/getOsVersion/)).toHaveCount(1);

    await devtools.button("Get app & version").click();
    await expect(devtools.apduRows(/getAppAndVersion/)).not.toHaveCount(0);
    await expect(devtools.apduRows(/getOsVersion.*9000 OK/)).toHaveCount(1);
  });

  test("sends a raw APDU and shows its response", async ({ devtools }) => {
    await devtools.sendApdu("E0 01 00 00 00");

    await expect(devtools.page.getByText(/^9000 OK/)).toBeVisible();
    await expect(devtools.apduRows(/getOsVersion/)).toHaveCount(1);
  });

  test("shows the status word of a rejected APDU", async ({ devtools }) => {
    await devtools.sendApdu("E0FF000000");

    const row = devtools.apduRows().last();
    await expect(row).not.toHaveAccessibleName(/9000/);
  });

  test("rejects an APDU that is not hex", async ({ devtools }) => {
    const before = await devtools.apduRows().count();

    await devtools.sendApdu("E0C40Z");

    await expect(devtools.page.getByText(/Invalid hex string/)).toBeVisible();
    await expect(devtools.apduRows()).toHaveCount(before);

    await devtools.sendApdu("E0C400000");
    await expect(devtools.page.getByText(/Invalid hex string/)).toBeVisible();
  });

  test("lists the APDUs of commands run from the sample", async ({
    devtools,
    sample,
  }) => {
    await sample.runCommand("Get battery status");

    await expect(
      devtools.apduRows(/getBatteryState|batteryStatus/i),
    ).not.toHaveCount(0);
  });

  test("expands an APDU into its sent and received bytes", async ({
    devtools,
  }) => {
    await devtools.button("Get OS version").click();
    const row = devtools.apduRows(/getOsVersion/);

    await row.click();

    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(devtools.page.getByText("e0 01 00 00 00")).toBeVisible();
    await expect(devtools.button("Copy sent bytes")).toBeVisible();
    await expect(devtools.button("Copy received bytes")).toBeVisible();
  });

  test("filters, clears and exports the APDU list", async ({
    devtools,
  }, testInfo) => {
    await devtools.button("Get OS version").click();
    await expect(devtools.apduCounter).toHaveText("2 exchanges");

    await devtools.apduFilter.fill("getOsVersion");
    await expect(devtools.apduRows()).toHaveCount(1);
    await devtools.apduFilter.fill("");
    await expect(devtools.apduRows()).toHaveCount(2);

    const file = testInfo.outputPath("apdus.json");
    await devtools.saveNextDownload(file);
    await devtools.button("Export APDUs").click();
    await expect.poll(() => devtools.downloadState()).toBe("completed");
    expect(JSON.parse(fs.readFileSync(file, "utf8"))).toHaveLength(2);

    await devtools.button("Clear APDUs").click();
    await expect(devtools.apduRows()).toHaveCount(0);
    await devtools.button("Get OS version").click();
    await expect(devtools.apduRows()).toHaveCount(1);
  });

  test("pauses the APDU list", async ({ devtools }) => {
    await devtools.button("Pause incoming logs").click();

    await devtools.button("Get OS version").click();
    await expect(devtools.page.getByText(/^9000 OK/)).toBeVisible();
    await expect(devtools.apduRows()).toHaveCount(1);

    await devtools.button("Resume incoming logs").click();
    await expect(devtools.apduRows()).toHaveCount(2);
  });

  test("selects APDUs for the AI", async ({ devtools }) => {
    await devtools.page
      .getByRole("checkbox", { name: "Select this APDU" })
      .first()
      .check();

    await expect(devtools.page.getByText(/^1 APDU selected/i)).toBeVisible();
    await expect(devtools.button("Explain with AI")).toBeVisible();
  });

  test("discovers and connects a second device from the dashboard", async ({
    devtools,
    mockClient,
  }) => {
    await mockClient.addDevice({ ...NANO_X, name: "Second Nano X" });

    await devtools.button("Listen").click();
    await expect(devtools.button("Stop")).toBeVisible();
    await expect(devtools.button("Discover")).toBeDisabled();
    const discovered = devtools.page
      .getByText("Second Nano X")
      .locator("xpath=ancestor::*[.//button[normalize-space()='Connect']][1]");
    await discovered.getByRole("button", { name: "Connect" }).click();

    await expect(devtools.sessionsTitle(2)).toBeVisible({ timeout: 15_000 });

    await devtools.button("Stop").click();
    await expect(devtools.button("Listen")).toBeVisible();
    await expect(devtools.button("Discover")).toBeEnabled();
  });

  test("marks the session disconnected when the sample disconnects", async ({
    devtools,
    sample,
  }) => {
    await sample.disconnect();

    await expect(
      devtools.page.getByRole("button", { name: /Ledger Nano X/ }).first(),
    ).toHaveAccessibleName(/NOT CONNECTED$/, { timeout: 10_000 });
  });

  test("hides and shows the sessions menu", async ({ devtools }) => {
    await devtools.button("Hide the sessions menu").click();
    await expect(devtools.sessionsTitle(1)).toBeHidden();

    await devtools.button("Show the sessions menu").click();
    await expect(devtools.sessionsTitle(1)).toBeVisible();
  });
});

test.describe("devtools: mock server live screen", () => {
  test("names the mock server the sample uses", async ({
    devtools,
    connectDevice,
  }) => {
    await connectDevice();
    await devtools.open("Inspector");

    await expect(
      devtools.page.getByText(
        "https://device-mock-server.aws.ldg-ps-default.ldg-tech.com",
      ),
    ).toBeVisible();
    const getOpenedLinks = await devtools.captureExternalLinks();
    await devtools.button("Open the mock server website").click();
    await expect.poll(getOpenedLinks).toHaveLength(1);
  });

  test("shows the dashboard of a device that has no app to emulate", async ({
    devtools,
    connectDevice,
  }) => {
    await devtools.answerMockServerApproval(true);
    await connectDevice();
    await devtools.open("Inspector");

    await expect(devtools.page.getByText("No apps installed")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("shows the Speculos screen once the user allows the mock server", async ({
    devtools,
    connectDevice,
    sample,
  }) => {
    test.setTimeout(150_000);
    await devtools.answerMockServerApproval(true);
    await connectDevice(STAX_ETH);
    await sample.runCommand("Open app", {
      field: "input-text_appName",
      value: "Ethereum",
    });
    await devtools.open("Inspector");

    await expect(
      devtools.page
        .getByTestId("container_device-screen")
        .locator("img[src^='blob:']"),
    ).toBeVisible({ timeout: 90_000 });
  });

  test("tells the user the screen is blocked when they deny the mock server", async ({
    devtools,
    connectDevice,
  }) => {
    await devtools.answerMockServerApproval(false);
    await connectDevice();
    await devtools.open("Inspector");

    await expect(devtools.page.getByText("Screen unavailable")).toBeVisible({
      timeout: 15_000,
    });
    await expect(devtools.page.getByText(/403 Forbidden/)).toBeVisible();
  });
});
