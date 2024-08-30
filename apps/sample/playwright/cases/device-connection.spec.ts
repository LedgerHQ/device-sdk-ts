import { expect, test } from "@playwright/test";

test("device connection", async ({ page }) => {
  // Navigate to the app
  await page.goto("http://localhost:3000/");

  // Open and interact with mock server switch
  await page.getByTestId("dropdown_mock-server-switch").click();
  await page.getByTestId("switch_mock-server").click();
  await page.getByTestId("dropdown_mock-server-switch").click();

  // Select the device
  await page.getByTestId("CTA_select-device").click();

  // Locate the first child of the device container
  const firstChild = page
    .getByTestId("container_devices")
    .locator("> *")
    .first();

  // Assert that the device is connected and visible
  await expect(
    firstChild.getByTestId("text_device-connection-status"),
  ).toContainText("CONNECTED");
  await expect(
    firstChild.getByTestId("text_device-connection-status"),
  ).toBeVisible();
});
