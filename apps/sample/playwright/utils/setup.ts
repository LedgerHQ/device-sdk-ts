import { MockClient } from "@ledgerhq/device-mockserver-client";
import { type Page } from "@playwright/test";

const MOCK_SERVER_URL =
  process.env["MOCK_SERVER_URL"] ??
  "https://device-mock-server.aws.ldg-ps-default.ldg-tech.com";
const SETTINGS_STORAGE_KEY = "dmk-sample-settings";
const GATING_TOKEN = process.env["NEXT_PUBLIC_GATING_TOKEN"];

export const setupMockServerSession = async (
  page: Page,
  { disablePolling = true }: { disablePolling?: boolean } = {},
): Promise<MockClient> => {
  const client = new MockClient(MOCK_SERVER_URL);
  const sessionToken = await client.authenticate();

  const settings: Record<string, unknown> = {
    transportType: "mockserver",
    mockServerUrl: MOCK_SERVER_URL,
    mockServerSessionToken: sessionToken,
  };
  if (disablePolling) {
    settings["pollingInterval"] = 0;
  }
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
