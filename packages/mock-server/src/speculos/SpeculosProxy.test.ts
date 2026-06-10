import { vi } from "vitest";

import { type SessionRecord, SessionStore } from "../store/SessionStore";
import { type SpeculinhoClient } from "./SpeculinhoClient";
import { resolveApdu } from "./SpeculosProxy";

// e0 d8 00 00 07 "Bitcoin"
const OPEN_BITCOIN = "e0d8000007426974636f696e";

const makeClient = (overrides: Partial<SpeculinhoClient> = {}) =>
  ({
    acquire: vi.fn().mockResolvedValue("run-1"),
    waitUntilReady: vi.fn().mockResolvedValue("https://run-1.speculos.test"),
    release: vi.fn().mockResolvedValue(undefined),
    forwardApdu: vi.fn().mockResolvedValue(" deadbeef9000"),
    ...overrides,
  }) as unknown as SpeculinhoClient;

const setup = () => {
  const store = new SessionStore();
  const { token } = store.createSession();
  const record = store.touch(token) as SessionRecord;
  const device = store.addDevice(record, {
    device_type: "nanoX",
    firmware_version: "1.3.0",
    apps: [{ name: "Bitcoin", version: "2.1.0" }],
  });
  return { store, record, device };
};

describe("resolveApdu", () => {
  it("rejects opening an app that is not installed", async () => {
    const { store, record } = setup();
    const device = store.addDevice(record, {
      device_type: "nanoX",
      firmware_version: "1.3.0",
      apps: [{ name: "Ethereum", version: "1.0.0" }],
    });
    const client = makeClient();

    const response = await resolveApdu({
      store,
      record,
      device,
      apduHex: OPEN_BITCOIN,
      client,
    });

    expect(response).toBe("6807");
    expect(client.acquire).not.toHaveBeenCalled();
  });

  it("acquires speculos on open app, then proxies subsequent APDUs", async () => {
    const { store, record, device } = setup();
    const client = makeClient();

    const open = await resolveApdu({
      store,
      record,
      device,
      apduHex: OPEN_BITCOIN,
      client,
    });
    expect(open).toBe("9000");
    expect(client.acquire).toHaveBeenCalledWith(
      {
        coin_app: "Bitcoin",
        coin_app_version: "2.1.0",
        device: "nanox",
        device_os_version: "1.3.0",
      },
      expect.any(String),
    );
    expect(store.getProxy(record, device.id)).toMatchObject({
      speculosUrl: "https://run-1.speculos.test",
      appName: "Bitcoin",
    });

    const next = await resolveApdu({
      store,
      record,
      device,
      apduHex: "b001000000",
      client,
    });
    expect(next).toBe(" deadbeef9000");
    expect(client.forwardApdu).toHaveBeenCalledWith(
      "https://run-1.speculos.test",
      "b001000000",
    );
  });

  it("releases speculos and reverts to mock mode on close app", async () => {
    const { store, record, device } = setup();
    const client = makeClient();
    store.setProxy(record, device.id, {
      runId: "run-1",
      speculosUrl: "https://run-1.speculos.test",
      appName: "Bitcoin",
    });

    const response = await resolveApdu({
      store,
      record,
      device,
      apduHex: "b0a7000000",
      client,
    });

    expect(response).toBe("9000");
    expect(client.release).toHaveBeenCalledWith("run-1");
    expect(store.getProxy(record, device.id)).toBeUndefined();
  });

  it("lets an explicit mock win over open-app interception", async () => {
    const { store, record, device } = setup();
    store.addMock(record, device.id, {
      prefix: OPEN_BITCOIN,
      response: "abcd9000",
    });
    const client = makeClient();

    const response = await resolveApdu({
      store,
      record,
      device,
      apduHex: OPEN_BITCOIN,
      client,
    });

    expect(response).toBe("abcd9000");
    expect(client.acquire).not.toHaveBeenCalled();
  });

  it("derives the handshake responses from the device when unmocked", async () => {
    const { store, record, device } = setup(); // nanoX, fw 1.3.0
    const client = makeClient();

    const osVersion = await resolveApdu({
      store,
      record,
      device,
      apduHex: "e0010000",
      client,
    });
    const appAndVersion = await resolveApdu({
      store,
      record,
      device,
      apduHex: "b0010000",
      client,
    });

    expect(osVersion.startsWith("33000004")).toBe(true); // Nano X target id
    expect(osVersion.endsWith("9000")).toBe(true);
    // 01 | 05 "BOLOS" | 05 "1.3.0" | 9000
    expect(appAndVersion).toBe("0105424f4c4f5305312e332e309000");
  });

  it("lets an explicit mock override a derived handshake response", async () => {
    const { store, record, device } = setup();
    store.addMock(record, device.id, {
      prefix: "e0010000",
      response: "deadbeef9000",
    });
    const response = await resolveApdu({
      store,
      record,
      device,
      apduHex: "e0010000",
      client: makeClient(),
    });
    expect(response).toBe("deadbeef9000");
  });

  it("falls back to 6d00 for an unmatched non-derivable APDU", async () => {
    const { store, record, device } = setup();
    const response = await resolveApdu({
      store,
      record,
      device,
      apduHex: "e0de000000",
      client: makeClient(),
    });
    expect(response).toBe("6d00");
  });

  it("returns 6d00 when the speculos proxy forward fails", async () => {
    const { store, record, device } = setup();
    const client = makeClient({
      forwardApdu: vi.fn().mockRejectedValue(new Error("down")),
    });
    store.setProxy(record, device.id, {
      runId: "run-1",
      speculosUrl: "https://run-1.speculos.test",
      appName: "Bitcoin",
    });

    const response = await resolveApdu({
      store,
      record,
      device,
      apduHex: "b001000000",
      client,
    });
    expect(response).toBe("6d00");
  });

  it("does not intercept open app when no client is configured", async () => {
    const { store, record, device } = setup();
    const response = await resolveApdu({
      store,
      record,
      device,
      apduHex: OPEN_BITCOIN,
      client: undefined,
    });
    expect(response).toBe("6d00");
  });

  it("returns 6d00 when speculos acquire fails", async () => {
    const { store, record, device } = setup();
    const client = makeClient({
      acquire: vi.fn().mockRejectedValue(new Error("boom")),
    });

    const response = await resolveApdu({
      store,
      record,
      device,
      apduHex: OPEN_BITCOIN,
      client,
    });

    expect(response).toBe("6d00");
    expect(client.release).toHaveBeenCalled();
    expect(store.getProxy(record, device.id)).toBeUndefined();
  });
});
