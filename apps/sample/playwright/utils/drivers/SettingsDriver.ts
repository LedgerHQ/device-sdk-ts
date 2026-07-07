import { expect, type Page } from "@playwright/test";

/** Drives assertions on the Settings view. */
export class SettingsDriver {
  constructor(private readonly page: Page) {}

  /** Assert the mock server session token input holds the given value. */
  async expectSessionTokenInput(value: string): Promise<void> {
    await expect(
      this.page.getByTestId("input_mock-server-session-token"),
    ).toHaveValue(value);
  }
}
