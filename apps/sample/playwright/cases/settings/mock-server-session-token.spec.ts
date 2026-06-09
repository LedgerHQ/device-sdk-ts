/* eslint-disable no-restricted-imports */
import { expect, test } from "@playwright/test";

// Verifies that seeding the sample app's persisted settings (localStorage) with
// a mock server session token before the app loads correctly populates the
// "Mock Server Session Token" input in the Settings view - the same mechanism
// the device-command specs rely on to share their session with the app.
const SETTINGS_STORAGE_KEY = "dmk-sample-settings";
const INJECTED_TOKEN = "playwright-injected-session-token";

test.describe("settings: mock server session token", () => {
  test("injected session token populates the settings input", async ({
    page,
  }) => {
    await test.step("Given the persisted settings are seeded with a token", async () => {
      await page.addInitScript(
        ({ storageKey, sessionToken }) => {
          localStorage.setItem(
            storageKey,
            JSON.stringify({
              transportType: "mockserver",
              mockServerSessionToken: sessionToken,
            }),
          );
        },
        { storageKey: SETTINGS_STORAGE_KEY, sessionToken: INJECTED_TOKEN },
      );

      await page.goto("http://localhost:3000/settings");
    });

    await test.step("Then the session token input shows the injected value", async () => {
      await expect(
        page.getByTestId("input_mock-server-session-token"),
      ).toHaveValue(INJECTED_TOKEN);
    });
  });
});
