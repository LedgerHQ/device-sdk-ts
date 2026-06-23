import { test } from "@root/playwright/fixtures";

// Verifies that seeding the sample app's persisted settings (localStorage) with
// a mock server session token before the app loads correctly populates the
// "Mock Server Session Token" input in the Settings view - the same mechanism
// the device-command specs rely on to share their session with the app. The
// `mockClient` fixture provisions a real session and seeds its token, so the app
// keeps it (an invalid token would be re-provisioned by useMockServerSession).
test.describe("settings: mock server session token", () => {
  test("seeded session token populates the settings input", async ({
    page,
    mockClient,
    settings,
  }) => {
    await test.step("Given the persisted settings are seeded with a session token", async () => {
      await page.goto("http://localhost:3000/settings");
    });

    await test.step("Then the session token input shows the seeded value", async () => {
      await settings.expectSessionTokenInput(mockClient.getToken()!);
    });
  });
});
