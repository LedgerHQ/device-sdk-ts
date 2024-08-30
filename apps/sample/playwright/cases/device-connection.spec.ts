import { expect, test } from "@playwright/test";

test("device connection", async ({ page }) => {
  // Navigate to the app
  await page.goto("http://localhost:3000/");

  // Open and interact with mock server switch
  await page.locator('[data-testid="dropdown_mock-server-switch"]').click();
  await page.locator('[data-testid="switch_mock-server"]').click();
  await page.locator('[data-testid="dropdown_mock-server-switch"]').click();

  // Select the device
  await page.locator('[data-testid="CTA_select-device"]').click();

  // Locate the first child of the device container
  const firstChild = page
    .locator('[data-testid="container_devices"] > *')
    .first();

  // Assert that the device is connected and visible
  await expect(
    firstChild.locator('[data-testid="text_device-connection-status"]'),
  ).toContainText("CONNECTED");
  await expect(
    firstChild.locator('[data-testid="text_device-connection-status"]'),
  ).toBeVisible();
});
