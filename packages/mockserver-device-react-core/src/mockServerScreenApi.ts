import { type MockServerClient, type ScreenApi } from "./types";

/** The proxy answers 409 when the device has no Speculos instance. */
const isNoInstance = (error: unknown): boolean =>
  (error as { status?: unknown } | null)?.status === 409;

export const mockServerScreenApi = (
  client: MockServerClient,
  deviceId: string,
): ScreenApi => ({
  screenshot: async () => {
    try {
      return await client.getScreenshot(deviceId);
    } catch (error) {
      if (isNoInstance(error)) return null;
      throw error;
    }
  },
  idle: async () => ({
    kind: "os-info",
    device: await client.getDevice(deviceId),
  }),
  pressButton: (button, action) => client.pressButton(deviceId, button, action),
  touch: (x, y, action) => client.touchScreen(deviceId, x, y, action),
  openApp: async (appName) => {
    const name = new TextEncoder().encode(appName);
    // Lc is a single byte.
    if (name.length > 0xff) {
      throw new Error(`App name too long to open: ${appName}`);
    }
    const { response } = await client.sendApdu(
      deviceId,
      Uint8Array.from([0xe0, 0xd8, 0x00, 0x00, name.length, ...name]),
    );
    const statusWord = response.slice(-4);
    if (statusWord !== "9000") {
      throw new Error(`Could not open ${appName} (${statusWord})`);
    }
  },
});
