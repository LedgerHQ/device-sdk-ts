import { DEFAULT_MOCKS } from "../defaults";
import { SessionStore } from "./SessionStore";

describe("SessionStore", () => {
  it("seeds the handshake mocks and no device on session creation", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    expect(store.listDevices(record)).toHaveLength(0);
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

    const device = store.addDevice(record, { device_type: "nanoX" });

    const connected = store.setConnected(record, device.id, true);
    expect(connected?.connected).toBe(true);

    const disconnected = store.setConnected(record, device.id, false);
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

  it("normalizes the single-response shorthand into a responses list", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    const mock = store.addMock(record, { prefix: "ff", response: "9000" });
    expect(mock.responses).toEqual(["9000"]);
    expect(store.consumeResponse(record, mock)).toBe("9000");
    expect(store.consumeResponse(record, mock)).toBe("9000");
  });

  it("serves queued responses in order and loops once exhausted", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    const mock = store.addMock(record, {
      prefix: "ff",
      responses: ["aa", "bb", "cc"],
    });

    expect(store.consumeResponse(record, mock)).toBe("aa");
    expect(store.consumeResponse(record, mock)).toBe("bb");
    expect(store.consumeResponse(record, mock)).toBe("cc");
    // loops back to the start
    expect(store.consumeResponse(record, mock)).toBe("aa");
    expect(store.consumeResponse(record, mock)).toBe("bb");
  });

  it("restarts a mock's sequence when it is edited", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    const mock = store.addMock(record, {
      prefix: "ff",
      responses: ["aa", "bb"],
    });
    expect(store.consumeResponse(record, mock)).toBe("aa");

    const edited = store.editMock(record, mock.id, {
      prefix: "ff",
      responses: ["11", "22"],
    })!;
    expect(store.consumeResponse(record, edited)).toBe("11");
  });

  it("resets cursors when mocks are cleared", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    const mock = store.addMock(record, {
      prefix: "ff",
      responses: ["aa", "bb"],
    });
    expect(store.consumeResponse(record, mock)).toBe("aa");

    store.clearMocks(record);
    const reAdded = store.addMock(record, {
      prefix: "ff",
      responses: ["aa", "bb"],
    });
    expect(store.consumeResponse(record, reAdded)).toBe("aa");
  });

  it("exports devices and mocks as a config-only snapshot", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    store.clearMocks(record);
    store.addDevice(record, { name: "Ledger Stax", device_type: "stax" });
    store.addMock(record, { prefix: "ff", responses: ["aa", "bb"] });

    const snapshot = store.exportSession(record);
    expect(snapshot.devices).toHaveLength(1);
    expect(snapshot.devices[0]).toMatchObject({
      name: "Ledger Stax",
      device_type: "stax",
    });
    // Runtime fields are stripped.
    expect(snapshot.devices[0]).not.toHaveProperty("id");
    expect(snapshot.devices[0]).not.toHaveProperty("connected");
    expect(snapshot.mocks).toEqual([{ prefix: "ff", responses: ["aa", "bb"] }]);
  });

  it("imports a snapshot, replacing devices, mocks and cursors", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    store.addDevice(record, { name: "Old", device_type: "nanoX" });
    const stale = store.addMock(record, { prefix: "aa", responses: ["00"] });
    store.consumeResponse(record, stale);

    const result = store.importSession(record, {
      devices: [{ name: "Imported", device_type: "flex" }],
      mocks: [{ prefix: "ff", responses: ["11", "22"] }],
    });

    const devices = store.listDevices(record);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe("Imported");

    const mocks = store.listMocks(record);
    expect(mocks).toHaveLength(1);
    // Fresh cursor: the imported sequence starts from the beginning.
    expect(store.consumeResponse(record, mocks[0]!)).toBe("11");

    expect(result.mocks).toEqual([{ prefix: "ff", responses: ["11", "22"] }]);
  });

  it("normalizes the single-response shorthand on import", () => {
    const store = new SessionStore();
    const { token } = store.createSession();
    const record = store.touch(token)!;

    const result = store.importSession(record, {
      devices: [],
      mocks: [{ prefix: "ff", response: "9000" }],
    });

    expect(result.mocks).toEqual([{ prefix: "ff", responses: ["9000"] }]);
  });
});
