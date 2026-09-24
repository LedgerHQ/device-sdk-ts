import { expect } from "@playwright/test";

import { test } from "@root/playwright/fixtures";

test.describe("sidebar: mock session card", () => {
  test("copies the session token and opens the Mock Server UI on it", async ({
    page,
    context,
    mockClient,
    sidebar,
  }) => {
    const token = mockClient.getToken()!;

    await test.step("Given the app runs on a mock server session", async () => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.goto("http://localhost:3000/");
      await sidebar.expectActiveMockSession();
    });

    await test.step("When copying the token, then the clipboard holds it", async () => {
      expect(await sidebar.copyMockSessionToken()).toBe(token);
    });

    await test.step("When opening the Mock Server UI, then it shows the same session", async () => {
      const mockServerUi = await sidebar.openMockServerUi();
      await expect(mockServerUi.getByText(token).first()).toBeVisible();
    });
  });
});
