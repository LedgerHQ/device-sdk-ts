import { expect, test } from "./fixtures";

test.describe("devtools: connection with the sample app", () => {
  test("shows how to set up each module before an app connects", async ({
    devtools,
  }) => {
    await devtools.expectConnected("Logger", false);
    await devtools.expectConnected("Inspector", false);
    await expect(
      devtools.page.getByRole("heading", { name: "Logger not connected" }),
    ).toBeVisible();

    await devtools.open("Inspector");
    await expect(
      devtools.page.getByRole("heading", { name: "Inspector not connected" }),
    ).toBeVisible();
  });

  test("connects the logger and the inspector when the sample loads", async ({
    devtools,
    sample,
  }) => {
    await sample.open();

    await devtools.expectConnected("Logger", true);
    await devtools.expectConnected("Inspector", true);
    await expect(devtools.logCounter).not.toHaveText("0 events");
  });

  test("replays what the sample sent before the dashboard reloaded", async ({
    devtools,
    connectDevice,
  }) => {
    await connectDevice();

    await devtools.page.reload();

    await devtools.expectConnected("Logger", true);
    await devtools.expectConnected("Inspector", true);
    await expect.poll(() => devtools.logCount()).toBeGreaterThan(0);
    await devtools.open("Inspector");
    await expect(devtools.sessionsTitle(1)).toBeVisible();
  });

  test("reconnects the sample when the DevTools app restarts", async ({
    restartDevtools,
    connectDevice,
  }) => {
    test.fail(
      true,
      "Bug: DevToolsWebSocketConnector only reconnects from onerror; a relay that closes cleanly fires onclose only",
    );
    test.setTimeout(60_000);
    await connectDevice();

    const restarted = await restartDevtools();

    // The connector retries every 5s
    await restarted.expectConnected("Logger", true, 30_000);
    await restarted.expectConnected("Inspector", true);
  });

  test("shows the modules as disconnected when the sample closes", async ({
    devtools,
    sample,
    page,
  }) => {
    test.fail(
      true,
      "Bug: the relay never tells the dashboard the client left, and connectedModules is never cleared",
    );
    await sample.open();
    await devtools.expectConnected("Logger", true);

    await page.close();

    await devtools.expectConnected("Logger", false, 10_000);
    await devtools.expectConnected("Inspector", false);
  });

  test("keeps one session per device across sample reloads", async ({
    devtools,
    connectDevice,
    sample,
    page,
  }) => {
    await connectDevice();
    await devtools.open("Inspector");
    await expect(devtools.sessionsTitle(1)).toBeVisible();

    await page.reload();
    await sample.connect();

    await expect(devtools.sessionsTitle(1)).toBeVisible();
  });
});
