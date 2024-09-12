import { asyncPipe } from "@/utils/pipes";
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

const getResponses = async (page: Page): Promise<Locator[]> => {
  return page
    .locator('[data-testid="box_device-commands-responses"] > *')
    .all();
};

const filterNonHiddenElements = async (
  responses: Locator[],
): Promise<Locator[]> => {
  const results = await Promise.all(
    responses.map(async (response) => {
      const isHidden = await response.evaluate((el) => {
        const style = getComputedStyle(el);
        return style.display === "none" || style.visibility === "hidden";
      });
      return !isHidden ? response : null;
    }),
  );
  return results.filter((child) => child !== null) as Locator[];
};

const getLastNonHiddenResponse = async (
  responses: Locator[],
): Promise<Locator | null> => {
  return responses.length > 0 ? responses[responses.length - 1] : null;
};

const getLastChildOfElementByTag =
  (tagType: string) =>
  async (element: Locator | null): Promise<Locator | null> => {
    if (!element) return null;
    try {
      const children = element.locator(`:scope > ${tagType}`);
      const lastChild = children.last();
      await lastChild.waitFor({ state: "attached" });
      return lastChild;
    } catch (error) {
      console.error(
        `Error getting last child of type '${tagType}' for element: ${error}`,
      );
      return null;
    }
  };

const parseJSONContent = async <T>(
  element: Locator | null,
): Promise<T | null> => {
  if (!element) return null;
  try {
    const textContent = await element.innerText();
    return JSON.parse(textContent) as T;
  } catch (error) {
    console.error(`Error parsing JSON content: ${error}`);
    return null;
  }
};

export const getLastDeviceResponseContent = async <T>(
  page: Page,
): Promise<T | null> => {
  return asyncPipe(
    getResponses,
    filterNonHiddenElements,
    getLastNonHiddenResponse,
    getLastChildOfElementByTag("span"),
    parseJSONContent,
  )(page);
};

export const isValidEthereumAddress = (address: string): boolean =>
  /^0x[a-fA-F0-9]{40}$/.test(address);

export const isValidPublicKey = (publicKey: string): boolean =>
  /^04[a-fA-F0-9]{128}$/.test(publicKey);
