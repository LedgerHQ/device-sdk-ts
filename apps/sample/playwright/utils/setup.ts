import { MockClient } from "@ledgerhq/device-mockserver-client";
import { type Page } from "@playwright/test";

const MOCK_SERVER_URL = "http://127.0.0.1:9752";
const SETTINGS_STORAGE_KEY = "dmk-sample-settings";

/**
 * Gating token (a.k.a. origin token) enabling the Web3 Checks / clear-signing
 * context features. Without a valid token the signer falls back to blind
 * signing. Sourced from the test env so CI can provide a real token.
 */
const GATING_TOKEN = process.env["NEXT_PUBLIC_GATING_TOKEN"];

/**
 * Setup a mock server session and inject the session token (and the gating
 * token, when provided) into the page's localStorage.
 */
export const setupMockServerSession = async (
  page: Page,
): Promise<MockClient> => {
  const client = new MockClient(MOCK_SERVER_URL);
  const sessionToken = await client.authenticate();

  const settings: Record<string, unknown> = {
    transportType: "mockserver",
    mockServerSessionToken: sessionToken,
  };
  // Only override the app default when a token is configured, so local runs
  // without the env var keep the built-in default.
  if (GATING_TOKEN) {
    settings["originToken"] = GATING_TOKEN;
  }

  await page.addInitScript(
    ({ storageKey, settings: injectedSettings }) => {
      localStorage.setItem(storageKey, JSON.stringify(injectedSettings));
    },
    { storageKey: SETTINGS_STORAGE_KEY, settings },
  );

  return client;
};
