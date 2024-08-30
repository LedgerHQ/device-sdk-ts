import { expect, test } from "@playwright/test";

test("device command: get app and version", async ({ page }) => {
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

  // Navigate to device commands using `getByTestId`
  await page.getByTestId("CTA_route-to-/commands").click();
  await page.waitForURL("http://localhost:3000/commands");

  // Execute the "Open app" command and verify visibility using `getByTestId`
  await page.getByTestId("CTA_command-Open app").click();
  await expect(page.getByTestId("form_device-commands")).toBeVisible();

  // Fill in the app name and send the open command using `getByTestId`
  await page.getByTestId("input_appName").fill("Bitcoin");
  await page.getByTestId("CTA_send-command").click();

  // Verify the response of opening the app using `getByTestId`
  await expect(page.getByTestId("box_device-commands-responses")).toContainText(
    '"status": "SUCCESS"',
  );

  // Close the app using the close button (SVG selector remains as is)
  await page
    .locator(
      'svg path[d="M20.328 18.84L13.488 12l6.84-6.84-1.536-1.44L12 10.512 5.208 3.72 3.672 5.16l6.84 6.84-6.84 6.84 1.536 1.44L12 13.488l6.792 6.792 1.536-1.44z"]',
    )
    .click();

  // Execute the "Get app and version" command using `getByTestId`
  await page.getByTestId("CTA_command-Get app and version").click();
  await page.getByTestId("CTA_send-command").click();

  // Verify the response of getting app and version using `getByTestId`
  const textContent = await page
    .getByTestId("box_device-commands-responses")
    .innerText();
  await expect(textContent).toContain('"status": "SUCCESS"');
  await expect(textContent).toContain("Bitcoin");
});
