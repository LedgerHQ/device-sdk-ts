import { Locator, Page } from "@playwright/test";

import { asyncPipe } from "@/utils/pipes";

type DeviceCommandParams = {
  inputField?: string;
  inputValue?: string;
};

const clickByTestId =
  (testId: string) =>
  async (page: Page): Promise<Page> => {
    await page.getByTestId(testId).click();
    return page;
  };

const clickBySelector =
  (selector: string) =>
  async (page: Page): Promise<Page> => {
    await page.locator(selector).click();
    return page;
  };

const waitForNavigation =
  (route: string) =>
  async (page: Page): Promise<Page> => {
    const expectedURL = `http://localhost:3000${route}`;
    await page.waitForURL(expectedURL, { timeout: 10000 });
    await page.waitForLoadState("networkidle");
    return page;
  };

const fillInputFields =
  (params: DeviceCommandParams | DeviceCommandParams[]) =>
  async (page: Page): Promise<Page> => {
    const paramsArray = Array.isArray(params) ? params : [params];
    for (const { inputField, inputValue } of paramsArray) {
      if (inputField && inputValue) {
        const input = page.getByTestId(inputField);
        await input.waitFor({ state: "visible" });
        await input.fill(inputValue);
      }
    }
    return page;
  };

export const whenOpenSelectDeviceDrawer = async (page: Page): Promise<Page> =>
  await clickByTestId("CTA_open-select-device-drawer")(page);

export const whenConnectingDevice = async (
  page: Page,
  closeDrawer: boolean = true,
): Promise<Page> => {
  await whenOpenSelectDeviceDrawer(page);
  const newPage = await clickByTestId("CTA_select-device")(page);
  if (closeDrawer) {
    return whenCloseDrawer(page);
  }
  return newPage;
};

export const whenClicking = (page: Page, ctaSelector: string): Promise<Page> =>
  clickByTestId(ctaSelector)(page);

export const whenNavigateTo = (page: Page, route: string): Promise<Page> =>
  asyncPipe(
    clickByTestId(`CTA_route-to-${route}`),
    waitForNavigation(route),
  )(page);

const executeClickCommand =
  (command: string, navigate: boolean) =>
  async (page: Page): Promise<Page> => {
    if (navigate) {
      await page.getByTestId(`CTA_command-${command}`).click();
    }
    return page;
  };

const executeClickSend =
  (type: string) =>
  async (page: Page): Promise<Page> => {
    await page.getByTestId(`CTA_send-${type}`).click();
    return page;
  };

export const whenExecute =
  (type: string, navigate: boolean = false) =>
  (
    page: Page,
    command: string,
    params: DeviceCommandParams | DeviceCommandParams[] = [],
  ): Promise<Page> =>
    asyncPipe(
      executeClickCommand(command, navigate),
      fillInputFields(params),
      executeClickSend(type),
    )(page);

export const whenExecuteDeviceAction = whenExecute("device-action", true);
export const whenExecuteDeviceCommand = whenExecute("device-command", true);

const getMainDevice = (page: Page): Locator =>
  page.getByTestId("container_main-device").locator("> *").first();

const getFirstDevice = (page: Page): Locator =>
  page.getByTestId("container_devices").locator("> *").first();

const clickDeviceOptionAndDisconnect = async (page: Page): Promise<Page> => {
  await page.getByTestId("dropdown_device-option").click();
  await page.getByTestId("CTA_disconnect-device").click();
  return page;
};

export const whenDisconnectDevice = (page: Page): Promise<Page> =>
  asyncPipe(getMainDevice, clickDeviceOptionAndDisconnect)(page);

export const whenDisconnectListedDevice = (page: Page): Promise<Page> =>
  asyncPipe(getFirstDevice, clickDeviceOptionAndDisconnect)(page);

const drawerCloseButtonSelector =
  'svg path[d="M20.328 18.84L13.488 12l6.84-6.84-1.536-1.44L12 10.512 5.208 3.72 3.672 5.16l6.84 6.84-6.84 6.84 1.536 1.44L12 13.488l6.792 6.792 1.536-1.44z"]';

export const whenCloseDrawer = (page: Page): Promise<Page> =>
  clickBySelector(drawerCloseButtonSelector)(page);
