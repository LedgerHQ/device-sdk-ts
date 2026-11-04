/* eslint-disable no-restricted-imports */
import fs from "node:fs";

import { expect, test } from "./fixtures";

test.describe("devtools: logger", () => {
  test.beforeEach(async ({ devtools, connectDevice }) => {
    await connectDevice();
    await devtools.expectConnected("Logger", true);
    await expect(
      devtools.logRows("[DeviceSessionService]").first(),
    ).toBeVisible();
  });

  test("streams new logs while the sample runs commands", async ({
    devtools,
    sample,
  }) => {
    const before = await devtools.logCount();

    await sample.runCommand("Get OS version");

    await expect.poll(() => devtools.logCount()).toBeGreaterThan(before);
    await expect(
      devtools.logRows(/getOsVersion|GetOsVersion/).first(),
    ).toBeVisible();
  });

  test("filters by text, negation and regex", async ({ devtools }) => {
    const total = await devtools.logCount();

    await devtools.setFilter("MockTransport");
    await expect.poll(() => devtools.logCount()).toBeLessThan(total);
    const matching = await devtools.logCount();
    expect(matching).toBeGreaterThan(0);
    await expect(devtools.logRows("[config]")).toHaveCount(0);

    await devtools.setFilter("-MockTransport");
    await expect.poll(() => devtools.logCount()).toBe(total - matching);
    await expect(devtools.logRows("[MockTransport]")).toHaveCount(0);

    await devtools.setFilter("/listing\\s+connected/");
    await expect.poll(() => devtools.logCount()).toBeGreaterThan(0);
    await expect(devtools.logRows("[MockTransport]")).toHaveCount(0);

    await devtools.button("Clear filter").click();
    await expect.poll(() => devtools.logCount()).toBe(total);
  });

  test("remembers recent filters", async ({ devtools }) => {
    // A filter becomes recent once it stays unchanged for 15s
    test.setTimeout(60_000);
    await devtools.setFilter("MockTransport");
    await devtools.page.waitForTimeout(16_000);
    await devtools.button("Clear filter").click();

    await devtools.button("Recent filters").first().click();
    await devtools.page.getByRole("option", { name: "MockTransport" }).click();

    await expect(devtools.filterInput).toHaveValue("MockTransport");
  });

  test("filters by tag and by level from the column headers", async ({
    devtools,
  }) => {
    const total = await devtools.logCount();

    await devtools.button("Filter by tag").click();
    await devtools.page
      .getByRole("checkbox", { name: "[MockTransport]" })
      .uncheck();
    await devtools.page.keyboard.press("Escape");
    await expect.poll(() => devtools.logCount()).toBeLessThan(total);
    await expect(devtools.logRows("[MockTransport]")).toHaveCount(0);

    await devtools.button("Filter by tag").click();
    await devtools.page.getByRole("checkbox", { name: "All" }).check();
    await devtools.page.keyboard.press("Escape");
    await expect.poll(() => devtools.logCount()).toBe(total);

    await devtools.button("Filter by level").click();
    await devtools.page.getByRole("checkbox", { name: "debug" }).uncheck();
    await devtools.page.keyboard.press("Escape");
    await expect.poll(() => devtools.logCount()).toBeLessThan(total);
    await expect(devtools.page.getByText("debug", { exact: true })).toHaveCount(
      0,
    );
  });

  test("finds matches and moves between them", async ({ devtools }) => {
    await devtools.findInput.fill("connected");

    const counter = devtools.page.getByText(/^\d+\/\d+$/);
    await expect(counter).toHaveText(/^1\/\d+$/);
    const total = Number((await counter.textContent())!.split("/")[1]);
    expect(total).toBeGreaterThan(1);

    await devtools.button("Next match (Enter)").click();
    await expect(counter).toHaveText(`2/${total}`);
    await devtools.button("Last match").click();
    await expect(counter).toHaveText(`${total}/${total}`);
    await devtools.button("First match").click();
    await expect(counter).toHaveText(`1/${total}`);
    await devtools.button("Previous match (Shift+Enter)").click();
    await expect(counter).toHaveText(`${total}/${total}`);

    await devtools.button("Clear search").click();
    await expect(devtools.findInput).toHaveValue("");
  });

  test("pauses and resumes incoming logs", async ({ devtools, sample }) => {
    await devtools.button("Pause incoming logs").first().click();
    const paused = await devtools.logCount();

    await sample.runCommand("Get OS version");
    await expect(devtools.logCounter).toHaveText(`paused · ${paused} events`);

    await devtools.button("Resume incoming logs").first().click();
    await expect.poll(() => devtools.logCount()).toBeGreaterThan(paused);
  });

  test("clears the logs and keeps receiving new ones", async ({
    devtools,
    sample,
  }) => {
    await devtools.button("Clear logs").click();
    await expect(devtools.logCounter).toHaveText("0 events");

    await sample.runCommand("Get OS version");

    await expect.poll(() => devtools.logCount()).toBeGreaterThan(0);
  });

  test("exports the logs as JSON", async ({ devtools }, testInfo) => {
    const count = await devtools.logCount();
    const file = testInfo.outputPath("logs.json");
    await devtools.saveNextDownload(file);

    await devtools.button("Export logs").click();

    await expect.poll(() => devtools.downloadState()).toBe("completed");
    const logs = JSON.parse(fs.readFileSync(file, "utf8")) as unknown[];
    expect(logs.length).toBeGreaterThanOrEqual(count);
  });

  test("expands a log payload", async ({ devtools }) => {
    const row = devtools.button(/Local config available/).first();

    await row.click();

    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(devtools.button("Copy payload")).toBeVisible();
    await expect(
      devtools.page.getByText('name: "@ledgerhq/device-management-kit"'),
    ).toBeVisible();
  });

  test("selects logs for the AI and clears the selection", async ({
    devtools,
  }) => {
    await devtools.logCheckboxes.nth(0).check();
    await devtools.logCheckboxes.nth(3).click({ modifiers: ["Shift"] });

    await expect(devtools.page.getByText(/^4 logs selected/)).toBeVisible();
    await expect(devtools.button("Explain with AI")).toBeVisible();

    await devtools.button("Clear").click();
    await expect(devtools.button("Explain with AI")).toBeHidden();
  });

  test("keeps filters when switching to the Inspector and back", async ({
    devtools,
  }) => {
    await devtools.setFilter("MockTransport");
    await devtools.findInput.fill("listen");

    await devtools.open("Inspector");
    await devtools.open("Logger");

    await expect(devtools.filterInput).toHaveValue("MockTransport");
    await expect(devtools.findInput).toHaveValue("listen");
  });
});
