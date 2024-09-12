import { asyncPipe } from "@/utils/pipes";
import { Page, Locator } from "@playwright/test";

type DeviceCommandParams = {
  inputField?: string;
  inputValue?: string;
};

// Utility functions to perform basic actions
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
    await Promise.all(
      paramsArray.map(async ({ inputField, inputValue }) => {
        if (inputField && inputValue) {
          await page.getByTestId(inputField).fill(inputValue);
        }
      }),
    );
    return page;
  };

// Core functions composed with asyncPipe
export const whenConnectingDevice = (page: Page): Promise<void> =>
  asyncPipe(clickByTestId("CTA_select-device"))(page);

export const whenClicking = (page: Page, ctaSelector: string): Promise<void> =>
  asyncPipe(clickByTestId(ctaSelector))(page);

export const whenNavigateTo = (page: Page, route: string): Promise<void> =>
  asyncPipe(
    clickByTestId(`CTA_route-to-${route}`),
    waitForNavigation(route),
  )(page);

// Commands for executing actions
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

// Higher-order functions to execute commands with pipes
export const whenExecute =
  (type: string, navigate: boolean = false) =>
  (
    page: Page,
    command: string,
    params: DeviceCommandParams | DeviceCommandParams[] = [],
  ): Promise<void> =>
    asyncPipe(
      executeClickCommand(command, navigate),
      fillInputFields(params),
      executeClickSend(type),
    )(page);

export const whenExecuteDeviceAction = whenExecute("device-action", true);
export const whenExecuteDeviceCommand = whenExecute("device-command", true);

// Device disconnect functions
const getFirstDevice = async (page: Page): Promise<Locator> => {
  const firstChild = page
    .getByTestId("container_devices")
    .locator("> *")
    .first();
  return firstChild;
};

const clickDeviceOptionAndDisconnect = async (page: Page): Promise<Page> => {
  await page.getByTestId("dropdown_device-option").click();
  await page.getByTestId("CTA_disconnect-device").click();
  return page;
};

export const whenDisconnectDevice = (page: Page): Promise<void> =>
  asyncPipe(getFirstDevice, clickDeviceOptionAndDisconnect)(page);

// Drawer close function
const drawerCloseButtonSelector =
  'svg path[d="M20.328 18.84L13.488 12l6.84-6.84-1.536-1.44L12 10.512 5.208 3.72 3.672 5.16l6.84 6.84-6.84 6.84 1.536 1.44L12 13.488l6.792 6.792 1.536-1.44z"]';

export const whenCloseDrawer = (page: Page): Promise<void> =>
  asyncPipe(clickBySelector(drawerCloseButtonSelector))(page);
