import { Page } from "@playwright/test";

type DeviceCommandParams = {
  inputField?: string;
  inputValue?: string;
};

// When: Navigate to device actions or commands page
export const whenNavigateTo = async (
  page: Page,
  route: string,
): Promise<void> => {
  await page.getByTestId(`CTA_route-to-${route}`).click();
  const expectedURL = `http://localhost:3000${route.endsWith("s") ? route : route + "s"}`;
  await page.waitForURL(expectedURL, { timeout: 10000 });
};

// When: Execute a device action with optional parameters
const whenExecute =
  (type: string) =>
  async (
    page: Page,
    command: string,
    params: DeviceCommandParams = {},
  ): Promise<void> => {
    await page
      .getByTestId(`CTA_command-${command}`)
      .waitFor({ state: "visible", timeout: 20000 });
    await page.getByTestId(`CTA_command-${command}`).click();
    await page
      .getByTestId(`form_${type}`)
      .waitFor({ state: "visible", timeout: 10000 });
    if (params.inputField && params.inputValue) {
      await page.getByTestId(params.inputField).fill(params.inputValue);
    }
    await page.getByTestId(`CTA_send-${type}`).click();
  };

// When: Execute a device action with optional parameters
export const whenExecuteDeviceAction = whenExecute("device-action");

// When: Execute a device command with optional parameters
export const whenExecuteDeviceCommand = whenExecute("device-command");

// When: Disconnect the device
export const whenDisconnectDevice = async (page: Page): Promise<void> => {
  const firstChild = page
    .getByTestId("container_devices")
    .locator("> *")
    .first();
  const deviceName = await firstChild
    .getByTestId("text_device-name")
    .textContent();
  if (!deviceName) {
    console.error(
      "Failed to retrieve the device name. It may be missing or not visible.",
    );
    throw new Error("Failed to retrieve the device name for disconnection.");
  }
  try {
    await firstChild.getByTestId("dropdown_device-option").click();
    await firstChild.getByTestId("CTA_disconnect-device").click();
  } catch (error) {
    console.error(
      `Failed to disconnect the device '${deviceName}'. Error:`,
      error,
    );
    throw error;
  }
};

// When: Close the overlay drawer
export const whenCloseDrawer = async (page: Page): Promise<void> => {
  try {
    await page
      .locator(
        'svg path[d="M20.328 18.84L13.488 12l6.84-6.84-1.536-1.44L12 10.512 5.208 3.72 3.672 5.16l6.84 6.84-6.84 6.84 1.536 1.44L12 13.488l6.792 6.792 1.536-1.44z"]',
      )
      .click();
  } catch (error) {
    console.error(`Failed to close app using SVG button:`, error);
    throw error;
  }
};
