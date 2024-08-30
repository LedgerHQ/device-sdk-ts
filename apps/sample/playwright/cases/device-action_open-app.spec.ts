import { expect, test } from "@playwright/test";

test("device action: open app", async ({ page }) => {
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

  // Navigate to device actions
  await page.getByTestId("CTA_route-to-/device-action").click();
  await page.waitForURL("http://localhost:3000/device-actions");

  // Execute the "Open app" command and verify visibility
  await page.getByTestId("CTA_command-Open app").click();
  await expect(page.getByTestId("form_device-action")).toBeVisible();

  // Fill in the app name and send the device action command
  await page.getByTestId("input_appName").fill("Bitcoin");
  await page.getByTestId("CTA_send-device-action").click();

  // Verify the response
  await expect(page.getByTestId("box_device-commands-responses")).toContainText(
    '"status": "completed"',
  );
});
