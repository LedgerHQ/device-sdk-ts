import { expect, Page } from "@playwright/test";

export const thenDeviceIsConnected = async (page: Page): Promise<void> => {
  const firstChild = page
    .getByTestId("container_devices")
    .locator("> *")
    .first();
  await expect(
    firstChild.getByTestId("text_device-connection-status"),
  ).toContainText("CONNECTED");
  await expect(
    firstChild.getByTestId("text_device-connection-status"),
  ).toBeVisible();
};

export const thenDeviceIsDisconnected = async (page: Page): Promise<void> => {
  try {
    const deviceNames = await page
      .getByTestId("container_devices")
      .locator("> *")
      .getByTestId("text_device-name")
      .allTextContents();
    await Promise.all(
      Object.entries(deviceNames).map(async ([index, deviceName]) => {
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

// Then: Verify the response contains specific text
export const thenVerifyResponseContains = async (
  page: Page,
  expectedText: string,
): Promise<void> => {
  await expect(page.getByTestId("box_device-commands-responses")).toContainText(
    expectedText,
  );
};
