import { expect, type Page } from "@playwright/test";

import { ResponsesDriver } from "./ResponsesDriver";

export interface DeviceActionResult<Output> {
  status: string;
  output?: Output;
  error?: unknown;
}

const RESPONSE_ITEMS = '[data-testid="box_device-commands-responses"] > *';

/**
 * Drives the Device Actions view: navigating to it, selecting and executing a
 * device action (including the secure-channel ones such as Genuine Check) and
 * reading back the emitted device-action states.
 */
export class DeviceActionsDriver {
  private readonly responses: ResponsesDriver;

  constructor(private readonly page: Page) {
    this.responses = new ResponsesDriver(page);
  }

  /** Navigate to the /device-actions route. */
  async goto(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/device-actions").click();
    await this.page.waitForURL("http://localhost:3000/device-actions", {
      timeout: 10_000,
    });
    await this.page.waitForLoadState("networkidle");
  }

  /**
   * Open a device action by its (partial) title, then click Execute. Matching by
   * text avoids depending on the emoji-prefixed test id of secure-channel rows.
   */
  async execute(title: string): Promise<void> {
    await this.open(title);
    await this.send();
  }

  /**
   * Return to the device-actions list. Selecting an action replaces the row list
   * with its tester, so navigate away and back to remount the view and show the
   * rows again (e.g. to run a second action after a first one completed).
   */
  async backToList(): Promise<void> {
    await this.page.getByTestId("CTA_route-to-/commands").click();
    await this.page.waitForURL("http://localhost:3000/commands", {
      timeout: 10_000,
    });
    await this.goto();
  }

  /** Open a device action row without executing it. */
  async open(title: string): Promise<void> {
    await this.page
      .locator('[data-testid^="CTA_command-"]', { hasText: title })
      .first()
      .click();
  }

  /** Open the Install App action, fill the app name, and Execute it. */
  async installApp(appName: string): Promise<void> {
    await this.open("Install App");
    const input = this.page.getByTestId("input-text_appName");
    await input.waitFor({ state: "visible" });
    await input.fill(appName);
    await this.send();
  }

  /** Open the Uninstall App action, fill the app name, and Execute it. */
  async uninstallApp(appName: string): Promise<void> {
    await this.open("Uninstall App");
    const input = this.page.getByTestId("input-text_appName");
    await input.waitFor({ state: "visible" });
    await input.fill(appName);
    await this.send();
  }

  /** Open the List Installed App action and Execute it. */
  async listInstalledApps(): Promise<void> {
    await this.open("List Installed App");
    await this.send();
  }

  /**
   * Open the Install or update applications action, set the comma-separated app
   * names, and Execute it.
   */
  async installOrUpdateApps(applications: string): Promise<void> {
    await this.open("Install or update applications");
    const input = this.page.getByTestId("input-text_applications");
    await input.waitFor({ state: "visible" });
    await input.fill(applications);
    await this.send();
  }

  /**
   * Open the Open app with dependencies action, set the target app and the
   * comma-separated dependencies, and Execute it. The final open step provisions
   * a real Speculos instance via the mock server's Speculinho proxy, so this
   * requires access to that backend (unlike the pure-mock secure-channel flows).
   */
  async openAppWithDependencies(
    appName: string,
    dependencies: string,
  ): Promise<void> {
    await this.open("Open app with dependencies");
    const appNameInput = this.page.getByTestId("input-text_appName");
    await appNameInput.waitFor({ state: "visible" });
    await appNameInput.fill(appName);
    const dependenciesInput = this.page.getByTestId("input-text_dependencies");
    await dependenciesInput.waitFor({ state: "visible" });
    await dependenciesInput.fill(dependencies);
    await this.send();
  }

  /**
   * Open the Wait for app and version action and Execute it.
   */
  async waitForAppAndVersion({
    unlockTimeout,
  }: { unlockTimeout?: number } = {}): Promise<void> {
    const commandButton = this.page.getByTestId(
      "CTA_command-Wait for app and version",
    );
    if (await commandButton.isVisible()) {
      await commandButton.click();
    }
    if (unlockTimeout !== undefined) {
      const input = this.page.locator("#unlockTimeout");
      await input.waitFor({ state: "visible" });
      await input.fill(String(unlockTimeout));
    }
    await this.send();
  }

  /** Click Execute on the currently open device action. */
  async send(): Promise<void> {
    await this.page.getByTestId("CTA_send-device-action").click();
  }

  /**
   * Wait until the last emitted device-action state is pending with the given
   * required user interaction.
   */
  async expectRequiredUserInteraction(
    interaction: string,
    { timeout = 10_000 }: { timeout?: number } = {},
  ): Promise<void> {
    const last = this.page.locator(RESPONSE_ITEMS).last();
    await expect(last).toContainText(
      `"requiredUserInteraction": "${interaction}"`,
      { timeout },
    );
  }

  /**
   * Wait for the last response to contain `until` (defaults to any `"status"`)
   * and return it parsed. Pass a more specific marker (e.g. `"completed"`) to
   * wait for a terminal device-action state.
   */
  async lastResponse<T>({
    until = '"status"',
    timeout = 30_000,
  }: { until?: string | RegExp; timeout?: number } = {}): Promise<T> {
    return this.responses.lastJson<T>(until, { timeout });
  }

  /**
   * Wait until any emitted (intermediate or terminal) device-action state
   * renders the given text. Useful to assert on a transient value such as a
   * progress update that is later replaced by a terminal state.
   */
  async expectAnyResponseContains(
    text: string,
    { timeout = 30_000 }: { timeout?: number } = {},
  ): Promise<void> {
    await expect(
      this.page.locator(RESPONSE_ITEMS).filter({ hasText: text }).first(),
    ).toBeVisible({ timeout });
  }

  /**
   * Wait until the last emitted device-action state renders the given terminal
   * error and return its text. Errors are rendered via `util.inspect` (not JSON),
   * so they are matched by their `_tag` (e.g. `RefusedByUserDAError`) rather than
   * a `"status"` field.
   */
  async expectError(
    errorTag: string,
    { timeout = 30_000 }: { timeout?: number } = {},
  ): Promise<string> {
    const last = this.page.locator(RESPONSE_ITEMS).last();
    await expect(last).toContainText(errorTag, { timeout });
    return last.innerText();
  }

  /**
   * Wait for the last emitted device-action state to be terminal and return it
   * parsed.
   */
  async lastResult<Output>({
    timeout = 90_000,
  }: { timeout?: number } = {}): Promise<DeviceActionResult<Output>> {
    const last = this.page.locator(RESPONSE_ITEMS).last();
    await expect(last).toContainText(
      /"status": "completed"|Device locked|DeviceLockedError/,
      { timeout },
    );

    const statusSpan = last.locator("span", { hasText: '"status"' });
    if ((await statusSpan.count()) > 0) {
      return JSON.parse(
        await statusSpan.last().innerText(),
      ) as DeviceActionResult<Output>;
    }

    return {
      status: "error",
      error: await last.innerText(),
    } as DeviceActionResult<Output>;
  }
}
