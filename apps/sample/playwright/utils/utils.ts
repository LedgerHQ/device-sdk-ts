import { Page } from "@playwright/test";

export const getScreenshot = async (
  page: Page,
  title: string = "screenshot",
): Promise<void> => {
  await page.screenshot({
    path: `./src/playwright/${title}.png`,
    fullPage: true,
  });
};
