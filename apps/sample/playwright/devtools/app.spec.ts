import { expect, test } from "./fixtures";

test.describe("devtools: app shell", () => {
  test("switches theme and keeps it after a restart", async ({
    devtools,
    restartDevtools,
  }) => {
    await devtools.button("Switch to dark theme").click();
    await expect(devtools.button("Switch to light theme")).toBeVisible();

    const restarted = await restartDevtools();

    await expect(restarted.button("Switch to light theme")).toBeVisible();
  });

  test("resizes a side panel with the keyboard", async ({
    devtools,
    connectDevice,
  }) => {
    await connectDevice();
    await devtools.open("Inspector");
    const handle = devtools.page
      .locator('[role="separator"][aria-label="Resize the panel"]:visible')
      .first();
    const before = Number(await handle.getAttribute("aria-valuenow"));

    await handle.focus();
    await devtools.page.keyboard.press("ArrowRight");
    await devtools.page.keyboard.press("ArrowRight");
    await expect(handle).toHaveAttribute("aria-valuenow", String(before + 32));

    await handle.dblclick();
    await expect(handle).toHaveAttribute("aria-valuenow", String(before));
  });

  test("keeps every APDU column readable with all panels open", async ({
    devtools,
    connectDevice,
  }) => {
    test.fail(
      true,
      "Bug: at the default 1280x800 window, opening the AI panel squeezes the APDU row until the command name is hidden",
    );
    await connectDevice();
    await devtools.open("Inspector");
    await devtools.button("Show the AI panel").click();
    await devtools.button("Get OS version").click();

    const command = devtools.page.getByText("getOsVersion", { exact: true });
    await expect(command).toBeVisible();
    const box = await command.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(40);
  });

  test("opens the AI panel ready to explain a selection", async ({
    devtools,
  }) => {
    await devtools.button("Show the AI panel").click();

    await expect(
      devtools.page.getByRole("heading", { name: "AI debugging" }),
    ).toBeVisible();
    await expect(
      devtools.page.getByRole("heading", {
        name: /Select logs or APDUs, then press Explain with AI|Sign in to Claude Code/,
      }),
    ).toBeVisible();

    await devtools.button("Hide the AI panel").click();
    await expect(
      devtools.page.getByRole("heading", { name: "AI debugging" }),
    ).toBeHidden();
  });

  test("explains a selected APDU with Claude", async ({
    devtools,
    connectDevice,
  }) => {
    test.skip(
      process.env["DEVTOOLS_E2E_AI"] !== "1",
      "Runs Claude Code with the local login: set DEVTOOLS_E2E_AI=1",
    );
    test.setTimeout(240_000);
    await connectDevice();
    await devtools.open("Inspector");
    await devtools.button("Get OS version").click();
    await devtools.page
      .getByRole("checkbox", { name: "Select this APDU" })
      .last()
      .check();

    await devtools.button("Explain with AI").click();

    await expect(
      devtools.page.getByRole("textbox", { name: "Ask a follow-up question" }),
    ).toBeVisible({ timeout: 200_000 });
    await expect(devtools.button("Retry")).toBeHidden();
    await expect(devtools.page.getByRole("complementary")).toContainText(
      /getOsVersion|OS version|0xE001|E0 01/i,
    );
  });
});
