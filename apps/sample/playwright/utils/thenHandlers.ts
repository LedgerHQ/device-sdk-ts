import { expect, Page } from "@playwright/test";

export const thenDeviceIsConnected = async (
  page: Page,
  deviceIndex: number = 0,
): Promise<void> => {
  const targetChild = page
    .getByTestId("container_devices")
    .locator("> *")
    .nth(deviceIndex);
  await expect(
    targetChild.getByTestId("text_device-connection-status"),
  ).toContainText("CONNECTED");
  await expect(
    targetChild.getByTestId("text_device-connection-status"),
  ).toBeVisible();
};

export const thenNoDeviceIsConnected = async (page: Page): Promise<void> => {
  try {
    const deviceNames = await page
      .getByTestId("container_devices")
      .locator("> *")
      .getByTestId("text_device-name")
      .allTextContents();
    await Promise.all(
      Object.entries(deviceNames).map(async ([_, deviceName]) => {
        await expect(
          page
            .getByTestId("text_device-name")
            .locator(`:has-text("${deviceName}")`),
          `Expected the device named '${deviceName}' to be disconnected and not visible, but it was found on the page.`,
        ).not.toBeVisible();
      }),
    );
  } catch (error) {
    console.error(
      "Verification failed: Some devices are still visible after attempting disconnection. Error:",
      error,
    );
    throw error;
  }
};

export const thenVerifyResponseContains = async (
  page: Page,
  expectedText: string,
): Promise<void> => {
  await expect(page.getByTestId("box_device-commands-responses")).toContainText(
    expectedText,
  );
};
