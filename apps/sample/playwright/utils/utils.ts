import { Locator, Page } from "@playwright/test";

export const getScreenshot = async (
  page: Page,
  title: string = "screenshot",
): Promise<void> => {
  await page.screenshot({
    path: `./src/playwright/${title}.png`,
    fullPage: true,
  });
};

async function getLastNonHiddenChildElement(
  page: Page,
  parentSelector: string,
) {
  const children = await page.locator(parentSelector).all();

  // Use Promise.all to resolve checks for non-hidden elements
  const results = await Promise.all(
    children.map(async (child) => {
      // Check if the element has hidden styles
      const isHidden = await child.evaluate((el) => {
        const style = getComputedStyle(el);
        return style.display === "none" || style.visibility === "hidden";
      });

      return !isHidden ? child : null; // Include if not hidden, otherwise return null
    }),
  );

  // Filter out null values to get only non-hidden elements
  const validNonHiddenChildren = results.filter(
    (child) => child !== null,
  ) as Locator[];

  // Return the last non-hidden child element
  return validNonHiddenChildren[validNonHiddenChildren.length - 1] || null;
}

export async function getLastChildOfElement(element: Locator) {
  const children = element.locator(":scope > *");
  const lastChild = children.last();
  await lastChild.waitFor({ state: "attached" });
  return lastChild;
}

export const getLastDeviceResponseContent = async <T>(
  page: Page,
): Promise<T> => {
  const lastDeviceResponse = await getLastNonHiddenChildElement(
    page,
    '[data-testid="box_device-commands-responses"] > *',
  );
  const lastDeviceResponseContent =
    await getLastChildOfElement(lastDeviceResponse);
  return JSON.parse(await lastDeviceResponseContent.innerText()) as T;
};

export const isValidEthereumAddress = (address: string): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(address);

export const isValidPublicKey = (publicKey: string): boolean =>
  /^04[a-fA-F0-9]{128}$/.test(publicKey);
