import { expect, test } from "@playwright/test";

test("device disconnection", async ({ page }) => {
  // Navigate to the app
  await page.goto("http://localhost:3000/");

  // Open and interact with mock server switch using `getByTestId`
  await page.getByTestId("dropdown_mock-server-switch").click();
  await page.getByTestId("switch_mock-server").click();
  await page.getByTestId("dropdown_mock-server-switch").click();

  // Select the device using `getByTestId`
  await page.getByTestId("CTA_select-device").click();

  // Locate the first child of the device container using `getByTestId`
  const firstChild = page
    .getByTestId("container_devices")
    .locator("> *")
    .first();

  // Get the device name using `getByTestId`
  const deviceName = await firstChild
    .getByTestId("text_device-name")
    .textContent();

  // Assert that the device is connected and visible using `getByTestId`
  await expect(
    firstChild.getByTestId("text_device-connection-status"),
  ).toContainText("CONNECTED");
  await expect(
    firstChild.getByTestId("text_device-connection-status"),
  ).toBeVisible();

  // Disconnect the device using `getByTestId`
  await firstChild.getByTestId("dropdown_device-option").click();
  await firstChild.getByTestId("CTA_disconnect-device").click();

  // Verify the device is no longer visible using `getByTestId`
  await expect(
    page.getByTestId("text_device-name").locator(`:has-text("${deviceName}")`),
  ).not.toBeVisible();
});
