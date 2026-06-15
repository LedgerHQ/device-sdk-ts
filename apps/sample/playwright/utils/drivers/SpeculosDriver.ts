import { type MockClient } from "@ledgerhq/device-mockserver-client";
import { deviceControllerClientFactory } from "@ledgerhq/speculos-device-controller";
import { type TestInfo } from "@playwright/test";

type DeviceControllerClient = ReturnType<typeof deviceControllerClientFactory>;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Transaction-review navigation tuning (mirrors clear-signing-tester).
const REVIEW_MAX_STEPS = 30;
const REVIEW_STEP_DELAY_MS = 1_500;
const WAIT_FOR_REVIEW_ATTEMPTS = 8;
const WAIT_FOR_REVIEW_DELAY_MS = 1_500;
const SIGN_HOLD_MS = { stax: 5_000, flex: 15_000 } as const;
const SETTINGS_NAV_DELAY_MS = 1_000;

// Screen text markers (lower-cased substring match), per the eth app screens.
const HOME_MARKERS = [
  "this app enables",
  "app is ready",
  "application is ready",
];
const LAST_PAGE_MARKERS = [
  "hold to sign",
  "sign transaction",
  "sign message",
  "accept and send",
];
const CONTINUE_TO_BLIND_MARKERS = ["continue to blind signing"];
const BLIND_WARNING_MARKERS = ["blind signing ahead"];
const BLIND_BLOCKED_MARKERS = ["go to settings"];
// Web3 Checks opt-in prompt ("Enable Transaction Check?"). Declined ("Maybe
// later") so the flow proceeds without calling the unreachable backend.
const TX_CHECK_MARKERS = ["transaction check"];

const includesAny = (text: string, markers: string[]): boolean => {
  const lower = text.toLowerCase();
  return markers.some((marker) => lower.includes(marker));
};

/**
 * Drives the live Speculos emulator backing a device (screen + buttons) and
 * surfaces what is on screen for debugging:
 *  - streams the on-screen text to the test log (`/events?stream=true`),
 *  - exposes screen-aware waits (`/events?currentscreenonly=true`),
 *  - captures screenshots (`/screenshot`) for report attachments.
 *
 * The emulator URL is discovered through the mock server
 * (`GET /devices/:id/speculos`); control then targets the emulator directly via
 * `@ledgerhq/speculos-device-controller`.
 */
export class SpeculosDriver {
  private controller?: DeviceControllerClient;
  private model = "";
  private speculosUrl = "";
  private readonly label: string;
  private screenPoll?: ReturnType<typeof setInterval>;
  private lastLoggedScreen = "";
  private shotCounter = 0;

  constructor(
    private readonly client: MockClient,
    private readonly deviceId: string,
    private readonly testInfo?: TestInfo,
  ) {
    this.label = deviceId.slice(0, 8);
  }

  /**
   * Wait until the device's Speculos instance is provisioned (opening an app is
   * slow), build the controller and start streaming the screen to the log.
   */
  async waitReady({
    timeoutMs = 90_000,
    intervalMs = 1_000,
  }: { timeoutMs?: number; intervalMs?: number } = {}): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      try {
        const instance = await this.client.getSpeculos(this.deviceId);
        this.speculosUrl = instance.speculos_url.replace(/\/+$/, "");
        this.controller = deviceControllerClientFactory(this.speculosUrl);
        this.model = instance.model.toLowerCase();
        this.startScreenLog();
        return;
      } catch (error) {
        if (Date.now() >= deadline) {
          throw new Error(
            `Speculos instance for ${this.deviceId} not ready within timeout: ${String(error)}`,
          );
        }
        await sleep(intervalMs);
      }
    }
  }

  // --- Screen visibility (#1 stream, #3 waits, #2 screenshot) ---------------

  /** Concatenated text of the screen currently displayed. */
  async currentScreen(): Promise<string> {
    if (!this.speculosUrl || typeof fetch === "undefined") return "";
    try {
      const res = await fetch(
        `${this.speculosUrl}/events?currentscreenonly=true`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return "";
      const json = (await res.json()) as { events?: { text?: string }[] };
      return (json.events ?? [])
        .map((event) => event.text ?? "")
        .join(" ")
        .trim();
    } catch {
      return "";
    }
  }

  /** Poll until the current screen text matches `matcher`, logging each change. */
  private async waitForScreen(
    matcher: string | RegExp,
    { timeoutMs = 30_000, intervalMs = 500 }: WaitOptions = {},
  ): Promise<string> {
    const regex =
      typeof matcher === "string" ? new RegExp(matcher, "i") : matcher;
    const deadline = Date.now() + timeoutMs;
    let last = "";
    for (;;) {
      const screen = await this.currentScreen();
      if (screen && screen !== last) {
        console.log(`[speculos ${this.label}] screen: ${screen}`);
        last = screen;
      }
      if (regex.test(screen)) return screen;
      if (Date.now() >= deadline) {
        throw new Error(
          `Speculos screen never matched ${String(regex)} (last seen: "${last}")`,
        );
      }
      await sleep(intervalMs);
    }
  }

  /** Wait until the device is displaying something (a screen has rendered). */
  async waitForAnyScreen(opts: WaitOptions = {}): Promise<string> {
    return this.waitForScreen(/\S/, opts);
  }

  /** Fetch a PNG screenshot of the current screen, or null on failure. */
  async screenshot(): Promise<Buffer | null> {
    if (!this.speculosUrl || typeof fetch === "undefined") return null;
    try {
      const res = await fetch(`${this.speculosUrl}/screenshot`, {
        headers: { Accept: "image/png" },
      });
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  /** Capture the current screen and attach it to the Playwright report. */
  async attachScreenshot(label: string): Promise<void> {
    if (!this.testInfo) return;
    const png = await this.screenshot();
    if (!png) return;
    const index = String(this.shotCounter++).padStart(2, "0");
    await this.testInfo.attach(`speculos-${this.label}-${index}-${label}.png`, {
      body: png,
      contentType: "image/png",
    });
  }

  /** Stop the screen log poller. Call on teardown. */
  dispose(): void {
    if (this.screenPoll) {
      clearInterval(this.screenPoll);
      this.screenPoll = undefined;
    }
  }

  /**
   * Log the on-screen text to the test output by polling the current screen
   * (one-shot requests — no long-lived connection that would keep the worker
   * alive). Stopped by {@link dispose}.
   */
  private startScreenLog(): void {
    if (typeof fetch === "undefined" || this.screenPoll) return;
    this.screenPoll = setInterval(() => {
      void (async () => {
        const screen = await this.currentScreen();
        if (screen && screen !== this.lastLoggedScreen) {
          this.lastLoggedScreen = screen;
          console.log(`[speculos ${this.label}] ${screen}`);
        }
      })();
    }, 700);
    // Never let the log poller keep the test worker alive.
    (this.screenPoll as { unref?: () => void }).unref?.();
  }

  // --- Control ---------------------------------------------------------------

  /** Low-level button controller (Nano). */
  buttons() {
    return this.ready().buttonFactory();
  }

  /** Low-level touch controller (Stax / Flex). */
  touch() {
    return this.ready().tapFactory(this.model);
  }

  /**
   * Approve a simple confirmation screen (e.g. verify an address). Waits for the
   * screen to render first, then confirms.
   */
  async approve(): Promise<void> {
    await this.waitForAnyScreen();
    await this.attachScreenshot("approve");
    if (this.isTouch()) {
      await this.touch().sign();
    } else {
      await this.buttons().both();
    }
  }

  /**
   * Approve a signing review (transaction or typed message) on touch devices,
   * mirroring the clear-signing-tester flow: wait for the review to start, page
   * through to the last screen — handling the "continue to blind signing" /
   * "blind signing ahead" screens, and rejecting if blind signing is blocked
   * ("Go to settings") — then hold to sign on the last page.
   */
  async approveSigning(): Promise<void> {
    if (!this.isTouch()) {
      await this.waitForAnyScreen();
      await this.buttons().pressSequence(["right", "right", "both"]);
      return;
    }

    const touch = this.touch();

    // 1. Wait until we leave the app home screen (the review has started).
    await this.pollUntil(
      async () => !includesAny(await this.currentScreen(), HOME_MARKERS),
      WAIT_FOR_REVIEW_ATTEMPTS,
      WAIT_FOR_REVIEW_DELAY_MS,
      "transaction review to start",
    );

    // 2. Page to the last screen, handling the blind-signing screens.
    for (let step = 0; step < REVIEW_MAX_STEPS; step += 1) {
      const screen = await this.currentScreen();
      console.log(`[speculos ${this.label}] review: ${screen}`);

      await this.attachScreenshot("review");
      if (includesAny(screen, LAST_PAGE_MARKERS)) break;
      if (includesAny(screen, BLIND_BLOCKED_MARKERS)) {
        await touch.reject();
        throw new Error("Blind signing is not enabled on the device");
      }
      if (includesAny(screen, TX_CHECK_MARKERS)) {
        // "Enable Transaction Check?" -> tap "Maybe later" to decline.
        await touch.secondaryButton();
      } else if (includesAny(screen, CONTINUE_TO_BLIND_MARKERS)) {
        await touch.continueToBlindSigning();
      } else if (includesAny(screen, BLIND_WARNING_MARKERS)) {
        await touch.acceptBlindSigning();
      } else if (screen === "" || includesAny(screen, HOME_MARKERS)) {
        // Transient idle screen while the host builds clear-signing contexts —
        // wait for the review to (re)appear rather than tapping blindly.
      } else {
        await touch.navigateNext();
      }
      await sleep(REVIEW_STEP_DELAY_MS);
    }

    if (!includesAny(await this.currentScreen(), LAST_PAGE_MARKERS)) {
      throw new Error("Did not reach the sign screen");
    }

    // 3. Hold to sign on the last page.
    await this.attachScreenshot("sign");
    await touch.sign(this.signHoldMs());
  }

  /**
   * Enable blind signing in the app settings (touch devices). Call from the app
   * home screen — e.g. after a first action has opened the app — so the
   * transaction review can proceed without clear-signing context.
   */
  async enableBlindSigning(): Promise<void> {
    if (!this.isTouch()) return;
    await this.waitForAnyScreen();
    const touch = this.touch();
    await touch.enterMenu();
    await sleep(SETTINGS_NAV_DELAY_MS);
    await touch.enableBlindSigningSettings();
    await sleep(SETTINGS_NAV_DELAY_MS);
    await touch.exitMenu();
    await sleep(SETTINGS_NAV_DELAY_MS);
  }

  private isTouch(): boolean {
    return this.model === "stax" || this.model === "flex";
  }

  private signHoldMs(): number {
    return this.model === "flex" ? SIGN_HOLD_MS.flex : SIGN_HOLD_MS.stax;
  }

  private async pollUntil(
    predicate: () => Promise<boolean>,
    attempts: number,
    delayMs: number,
    what: string,
  ): Promise<void> {
    for (let i = 0; i < attempts; i += 1) {
      if (await predicate()) return;
      await sleep(delayMs);
    }
    throw new Error(`Timed out waiting for ${what}`);
  }

  private ready(): DeviceControllerClient {
    if (!this.controller) {
      throw new Error("SpeculosDriver not ready — call waitReady() first");
    }
    return this.controller;
  }
}

type WaitOptions = { timeoutMs?: number; intervalMs?: number };
