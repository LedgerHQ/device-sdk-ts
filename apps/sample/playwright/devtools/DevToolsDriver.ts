/* eslint-disable no-restricted-imports */
import { createRequire } from "node:module";
import path from "node:path";

import {
  _electron as electron,
  type ElectronApplication,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

// eslint-disable-next-line no-restricted-globals
const DEVTOOLS_APP_DIR = path.join(__dirname, "../../../devtools");

export type DevToolsScreen = "Logger" | "Inspector";

/**
 * Drives the DevTools Electron dashboard (apps/devtools/out). The app also runs
 * the WebSocket relay the sample connects to on ws://localhost:10001.
 */
export class DevToolsDriver {
  private constructor(
    readonly app: ElectronApplication,
    readonly page: Page,
  ) {}

  /**
   * Launch the built app. Reusing `userDataDir` keeps its localStorage (theme,
   * recent filters, panel sizes) across launches.
   */
  static async launch(userDataDir: string): Promise<DevToolsDriver> {
    const executablePath = createRequire(
      path.join(DEVTOOLS_APP_DIR, "package.json"),
    )("electron") as string;
    const app = await electron.launch({
      executablePath,
      args: [DEVTOOLS_APP_DIR, `--user-data-dir=${userDataDir}`],
    });
    const page = await app.firstWindow();
    await expect(page.getByRole("radio", { name: /^Logger/ })).toBeVisible();
    return new DevToolsDriver(app, page);
  }

  async close(): Promise<void> {
    await this.app.close();
  }

  /** Answer the native mock server approval dialog instead of showing it. */
  async answerMockServerApproval(allow: boolean): Promise<void> {
    await this.app.evaluate(
      ({ dialog }, response) => {
        dialog.showMessageBox = (() =>
          Promise.resolve({
            response,
            checkboxChecked: false,
          })) as unknown as typeof dialog.showMessageBox;
      },
      allow ? 0 : 1,
    );
  }

  /** Record the URLs the app hands to the OS instead of opening a browser. */
  async captureExternalLinks(): Promise<() => Promise<string[]>> {
    await this.app.evaluate(({ shell }) => {
      const opened: string[] = [];
      (globalThis as { openedLinks?: string[] }).openedLinks = opened;
      shell.openExternal = (url: string) => {
        opened.push(url);
        return Promise.resolve();
      };
    });
    return () =>
      this.app.evaluate(
        () => (globalThis as { openedLinks?: string[] }).openedLinks ?? [],
      );
  }

  // --- Navigation bar -------------------------------------------------------

  screenTab(screen: DevToolsScreen): Locator {
    return this.page.getByRole("radio", { name: new RegExp(`^${screen}`) });
  }

  async open(screen: DevToolsScreen): Promise<void> {
    await this.screenTab(screen).click();
    await expect(this.screenTab(screen)).toBeChecked();
  }

  async expectConnected(
    screen: DevToolsScreen,
    connected: boolean,
    timeout?: number,
  ): Promise<void> {
    await expect(this.screenTab(screen)).toHaveAccessibleName(
      `${screen} ${connected ? "Connected" : "Not connected"}`,
      { timeout },
    );
  }

  button(name: string | RegExp): Locator {
    return this.page.getByRole("button", {
      name,
      exact: typeof name === "string",
    });
  }

  // --- Logger ---------------------------------------------------------------

  get filterInput(): Locator {
    return this.page.getByRole("combobox", { name: "Filter logs" });
  }

  get findInput(): Locator {
    return this.page.getByRole("textbox", { name: "Find in logs" });
  }

  get logCheckboxes(): Locator {
    return this.page.getByRole("checkbox", { name: "Select this log" });
  }

  /** The "[paused · ]<n> events[ · <m> filtered out]" counter of the logs table. */
  get logCounter(): Locator {
    return this.page.getByText(
      /^(paused · )?[\d,]+ events?( · [\d,]+ filtered out)?$/,
    );
  }

  /** Logs the table shows: the total minus the filtered-out ones. */
  async logCount(): Promise<number> {
    const text = (await this.logCounter.textContent()) ?? "";
    const toNumber = (s: string | undefined) =>
      Number(s?.replace(/,/g, "") ?? 0);
    const total = toNumber(/([\d,]+) events?/.exec(text)?.[1]);
    return total - toNumber(/([\d,]+) filtered out/.exec(text)?.[1]);
  }

  /**
   * Save the next download to `filePath` instead of showing the native save
   * dialog, and resolve once it is written.
   */
  async saveNextDownload(filePath: string): Promise<void> {
    await this.app.evaluate(({ session }, savePath) => {
      session.defaultSession.once("will-download", (_event, item) => {
        item.setSavePath(savePath);
        item.once("done", (_e, state) => {
          (globalThis as { downloadState?: string }).downloadState = state;
        });
      });
    }, filePath);
  }

  async downloadState(): Promise<string | undefined> {
    return this.app.evaluate(
      () => (globalThis as { downloadState?: string }).downloadState,
    );
  }

  /** Rendered log rows whose tag or message contains `text`. */
  logRows(text: string | RegExp): Locator {
    return this.page.getByRole("paragraph").filter({ hasText: text });
  }

  async setFilter(value: string): Promise<void> {
    await this.filterInput.fill(value);
    await this.filterInput.press("Enter");
  }

  // --- Inspector ------------------------------------------------------------

  get apduInput(): Locator {
    return this.page.getByRole("textbox", { name: "APDU to send" });
  }

  get apduFilter(): Locator {
    return this.page.getByRole("textbox", { name: "Filter APDUs" });
  }

  get apduCounter(): Locator {
    return this.page.getByText(/^\d+ exchanges?$/);
  }

  /** APDU list rows, named "<time> <OS|app> <command> <n> B → <n> B <sw> <text>". */
  apduRows(command: string | RegExp = /→/): Locator {
    return this.page
      .getByRole("button", { name: command })
      .filter({ hasText: "→" });
  }

  async sendApdu(apduHex: string): Promise<void> {
    await this.apduInput.fill(apduHex);
    await this.button("Send APDU").click();
  }

  sessionsTitle(count: number): Locator {
    return this.page.getByText(`Sessions · ${count}`, { exact: true });
  }

  sessionDetail(term: string): Locator {
    return this.page
      .getByRole("term")
      .filter({ hasText: new RegExp(`^${term}$`) })
      .locator("xpath=following-sibling::dd[1]");
  }
}
