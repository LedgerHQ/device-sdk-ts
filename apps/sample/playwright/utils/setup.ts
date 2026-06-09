import { MockClient } from "@ledgerhq/device-mockserver-client";
import { type Page } from "@playwright/test";

const MOCK_SERVER_URL = "http://127.0.0.1:8080";
const SETTINGS_STORAGE_KEY = "dmk-sample-settings";

/**
 * Setup a mock server session and inject the session token into the page's
 * localStorage.
 */
export const setupMockServerSession = async (
  page: Page,
): Promise<MockClient> => {
  const client = new MockClient(MOCK_SERVER_URL);
  const sessionToken = await client.authenticate();

  await page.addInitScript(
    ({ storageKey, sessionToken: injectedSessionToken }) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          transportType: "mockserver",
          mockServerSessionToken: injectedSessionToken,
        }),
      );
    },
    { storageKey: SETTINGS_STORAGE_KEY, sessionToken },
  );

  return client;
};
