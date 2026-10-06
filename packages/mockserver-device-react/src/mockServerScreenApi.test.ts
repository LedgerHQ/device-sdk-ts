import { mockServerScreenApi } from "./mockServerScreenApi";
import { type MockServerClient } from "./types";

const aClient = (overrides: Partial<Record<keyof MockServerClient, unknown>>) =>
  ({
    getScreenshot: vi.fn(),
    getDevice: vi.fn(),
    pressButton: vi.fn(() => Promise.resolve()),
    touchScreen: vi.fn(() => Promise.resolve()),
    ...overrides,
  }) as unknown as MockServerClient;

describe("mockServerScreenApi", () => {
  it("resolves the screenshot of the device", async () => {
    const blob = new Blob(["png"]);
    const client = aClient({
      getScreenshot: vi.fn(() => Promise.resolve(blob)),
    });

    await expect(
      mockServerScreenApi(client, "device-1").screenshot(),
    ).resolves.toBe(blob);
    expect(client.getScreenshot).toHaveBeenCalledWith("device-1");
  });

  it("resolves no screenshot when the device has no Speculos instance", async () => {
    const client = aClient({
      getScreenshot: vi.fn(() => Promise.reject({ status: 409 })),
    });

    await expect(
      mockServerScreenApi(client, "device-1").screenshot(),
    ).resolves.toBeNull();
  });

  it("rethrows any other screenshot failure", async () => {
    const error = Object.assign(new Error("boom"), { status: 500 });
    const client = aClient({
      getScreenshot: vi.fn(() => Promise.reject(error)),
    });

    await expect(
      mockServerScreenApi(client, "device-1").screenshot(),
    ).rejects.toBe(error);
  });

  it("shows the device record while idle", async () => {
    const device = { id: "device-1", device_type: "nanoX" };
    const client = aClient({ getDevice: vi.fn(() => Promise.resolve(device)) });

    await expect(
      mockServerScreenApi(client, "device-1").idle?.(),
    ).resolves.toEqual({
      kind: "os-info",
      device,
    });
  });

  it("forwards buttons and touches to the device", async () => {
    const client = aClient({});
    const api = mockServerScreenApi(client, "device-1");

    await api.pressButton("left", "press");
    await api.touch(10, 20, "release");

    expect(client.pressButton).toHaveBeenCalledWith(
      "device-1",
      "left",
      "press",
    );
    expect(client.touchScreen).toHaveBeenCalledWith(
      "device-1",
      10,
      20,
      "release",
    );
  });

  it("opens an app by name", async () => {
    const sendApdu = vi.fn(() => Promise.resolve({ response: "9000" }));
    const api = mockServerScreenApi(aClient({ sendApdu }), "device-1");

    await api.openApp?.("Bitcoin");

    expect(sendApdu).toHaveBeenCalledWith(
      "device-1",
      Uint8Array.from([
        0xe0,
        0xd8,
        0x00,
        0x00,
        0x07,
        ...new TextEncoder().encode("Bitcoin"),
      ]),
    );
  });

  it("fails to open an app the device refuses", async () => {
    const sendApdu = vi.fn(() => Promise.resolve({ response: "6807" }));
    const api = mockServerScreenApi(aClient({ sendApdu }), "device-1");

    await expect(api.openApp?.("Bitcoin")).rejects.toThrow("6807");
  });

  it("refuses an app name too long for one APDU", async () => {
    const sendApdu = vi.fn(() => Promise.resolve({ response: "9000" }));
    const api = mockServerScreenApi(aClient({ sendApdu }), "device-1");

    await expect(api.openApp?.("a".repeat(256))).rejects.toThrow("too long");
    expect(sendApdu).not.toHaveBeenCalled();
  });
});
