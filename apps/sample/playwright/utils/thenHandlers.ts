import { expect, Locator, Page } from "@playwright/test";

import { asyncPipe } from "@/utils/pipes";

const getDeviceLocator = (page: Page): Page => {
  const targetChild = page.getByTestId("container_main-device").locator("> *");
  return targetChild as unknown as Page;
};

const getListedDeviceLocator =
  (deviceIndex: number) =>
  (page: Page): Page => {
    const targetChild = page
      .getByTestId("container_devices")
      .locator("> *")
      .nth(deviceIndex);
    return targetChild as unknown as Page;
  };

const verifyDeviceConnectedStatus = async (
  locator: Locator,
): Promise<Locator> => {
  await expect(
    locator.getByTestId("text_device-connection-status"),
  ).toContainText("CONNECTED");
  await expect(
    locator.getByTestId("text_device-connection-status"),
  ).toBeVisible();
  return locator;
};

export const thenDeviceIsConnected = (page: Page): Promise<Locator> =>
  asyncPipe(getDeviceLocator, verifyDeviceConnectedStatus)(page);

export const thenDeviceIsListedAndConnected = (
  page: Page,
  index: number,
): Promise<Locator> =>
  asyncPipe(getListedDeviceLocator(index), verifyDeviceConnectedStatus)(page);

const getAllDeviceNames = async (page: Page): Promise<string[]> => {
  return page
    .getByTestId("container_devices")
    .locator("> *")
    .getByTestId("text_device-name")
    .allTextContents();
};

const verifyDevicesNotVisible =
  (deviceNames: string[]) =>
  async (page: Page): Promise<Page> => {
    await Promise.all(
      deviceNames.map(async (deviceName) => {
        await expect(
          page
            .getByTestId("text_device-name")
            .locator(`:has-text("${deviceName}")`),
        ).not.toBeVisible();
      }),
    );
    return page;
  };

export const thenNoDeviceIsConnected = (page: Page): Promise<Page> =>
  asyncPipe(getAllDeviceNames, verifyDevicesNotVisible)(page);
