import { DEFAULT_DEVICE_ID, DEFAULT_MOCKS } from "../defaults";
import { SessionStore } from "./SessionStore";

describe("SessionStore", () => {
  it("seeds a default device and the handshake mocks on session creation", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    const devices = store.listDevices(record);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.id).toBe(DEFAULT_DEVICE_ID);
    expect(devices[0]?.device_type).toBe("nanoX");

    expect(store.listMocks(record)).toHaveLength(DEFAULT_MOCKS.length);
  });

  it("resolves a session from its token and rejects unknown tokens", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    expect(store.touch(token)).toBeDefined();
    expect(store.touch("nope")).toBeUndefined();
  });

  it("expires sessions past their TTL and sweeps them", () => {
    const store = new SessionStore({ ttlMs: -1 });
    store.createSession();
    expect(store.size()).toBe(1);
    expect(store.sweep()).toBe(1);
    expect(store.size()).toBe(0);
  });

  it("toggles connection state", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    const connected = store.setConnected(record, DEFAULT_DEVICE_ID, true);
    expect(connected?.connected).toBe(true);

    const disconnected = store.setConnected(record, DEFAULT_DEVICE_ID, false);
    expect(disconnected?.connected).toBe(false);
  });

  it("manages session-scoped mocks", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    const created = store.addMock(record, {
      prefix: "ff",
      response: "9000",
    });
    expect(store.listMocks(record).some((m) => m.id === created.id)).toBe(true);

    store.clearMocks(record);
    expect(store.listMocks(record)).toHaveLength(0);
  });
});
