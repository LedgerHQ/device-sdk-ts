import { Page } from "@playwright/test";

// Given: Navigate to the app and ensure a device is connected
export const givenDeviceIsConnected = async (page: Page): Promise<void> => {
  await page.getByTestId("CTA_select-device").click();
};
