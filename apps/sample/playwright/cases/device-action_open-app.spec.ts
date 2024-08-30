import { expect, test } from "@playwright/test";

test("device action: open app", async ({ page }) => {
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

  // Assert that the device is connected and visible using `getByTestId`
  await expect(
    firstChild.getByTestId("text_device-connection-status"),
  ).toContainText("CONNECTED");
  await expect(
    firstChild.getByTestId("text_device-connection-status"),
  ).toBeVisible();

  // Navigate to device actions using `getByTestId`
  await page.getByTestId("CTA_route-to-/device-action").click();
  await page.waitForURL("http://localhost:3000/device-actions");

  // Execute the "Open app" command and verify visibility using `getByTestId`
  await page.getByTestId("CTA_command-Open app").click();
  await expect(page.getByTestId("form_device-action")).toBeVisible();

  // Fill in the app name and send the device action command using `getByTestId`
  await page.getByTestId("input_appName").fill("Bitcoin");
  await page.getByTestId("CTA_send-device-action").click();

  // Verify the response using `getByTestId`
  await expect(page.getByTestId("box_device-commands-responses")).toContainText(
    '"status": "completed"',
  );
});
