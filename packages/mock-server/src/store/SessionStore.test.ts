import { SessionStore } from "./SessionStore";

const newSession = () => {
  const store = new SessionStore();
  const { token } = store.createSession();
  const record = store.touch(token)!;
  return { store, record };
};

describe("SessionStore", () => {
  it("creates a session with no devices and no mocks", () => {
    const { store, record } = newSession();
    expect(store.listDevices(record)).toHaveLength(0);
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
    const { store, record } = newSession();
    const device = store.addDevice(record, { device_type: "nanoX" });

    expect(store.setConnected(record, device.id, true)?.connected).toBe(true);
    expect(store.setConnected(record, device.id, false)?.connected).toBe(false);
  });

  it("starts a new device with an empty mock table", () => {
    const { store, record } = newSession();
    const device = store.addDevice(record, { device_type: "nanoX" });
    expect(store.listMocks(record, device.id)).toEqual([]);
  });

  it("seeds mocks from the device config (import path)", () => {
    const { store, record } = newSession();
    const device = store.addDevice(record, {
      device_type: "nanoX",
      mocks: [{ prefix: "ff", response: "9000" }],
    });
    const mocks = store.listMocks(record, device.id)!;
    expect(mocks).toHaveLength(1);
    expect(mocks[0]).toMatchObject({ prefix: "ff", responses: ["9000"] });
  });

  it("returns undefined for mocks of an unknown device", () => {
    const { store, record } = newSession();
    expect(store.listMocks(record, "nope")).toBeUndefined();
    expect(
      store.addMock(record, "nope", { prefix: "ff", response: "00" }),
    ).toBeUndefined();
  });

  it("manages a device's mocks independently", () => {
    const { store, record } = newSession();
    const a = store.addDevice(record, { device_type: "nanoX" });
    const b = store.addDevice(record, { device_type: "stax" });

    store.addMock(record, a.id, { prefix: "aa", response: "9000" });
    expect(store.listMocks(record, a.id)).toHaveLength(1);
    expect(store.listMocks(record, b.id)).toHaveLength(0);

    store.clearMocks(record, a.id);
    expect(store.listMocks(record, a.id)).toHaveLength(0);
  });

  it("normalizes the single-response shorthand into a responses list", () => {
    const { store, record } = newSession();
    const device = store.addDevice(record, { device_type: "nanoX" });
    const mock = store.addMock(record, device.id, {
      prefix: "ff",
      response: "9000",
    })!;
    expect(mock.responses).toEqual(["9000"]);
    expect(store.consumeResponse(record, device.id, mock)).toBe("9000");
    expect(store.consumeResponse(record, device.id, mock)).toBe("9000");
  });

  it("serves queued responses in order and loops once exhausted", () => {
    const { store, record } = newSession();
    const device = store.addDevice(record, { device_type: "nanoX" });
    const mock = store.addMock(record, device.id, {
      prefix: "ff",
      responses: ["aa", "bb", "cc"],
    })!;

    expect(store.consumeResponse(record, device.id, mock)).toBe("aa");
    expect(store.consumeResponse(record, device.id, mock)).toBe("bb");
    expect(store.consumeResponse(record, device.id, mock)).toBe("cc");
    expect(store.consumeResponse(record, device.id, mock)).toBe("aa");
  });

  it("restarts a mock's sequence when it is edited", () => {
    const { store, record } = newSession();
    const device = store.addDevice(record, { device_type: "nanoX" });
    const mock = store.addMock(record, device.id, {
      prefix: "ff",
      responses: ["aa", "bb"],
    })!;
    expect(store.consumeResponse(record, device.id, mock)).toBe("aa");

    const edited = store.editMock(record, device.id, mock.id, {
      prefix: "ff",
      responses: ["11", "22"],
    })!;
    expect(store.consumeResponse(record, device.id, edited)).toBe("11");
  });

  it("drops a device's mocks when the device is removed", () => {
    const { store, record } = newSession();
    const device = store.addDevice(record, { device_type: "nanoX" });
    store.addMock(record, device.id, { prefix: "ff", response: "9000" });

    store.deleteDevice(record, device.id);
    expect(store.listMocks(record, device.id)).toBeUndefined();
  });

  it("exports devices with their mocks nested (config-only)", () => {
    const { store, record } = newSession();
    const device = store.addDevice(record, {
      name: "Ledger Stax",
      device_type: "stax",
    });
    store.addMock(record, device.id, { prefix: "ff", responses: ["aa", "bb"] });

    const snapshot = store.exportSession(record);
    expect(snapshot).not.toHaveProperty("mocks");
    expect(snapshot.devices).toHaveLength(1);
    expect(snapshot.devices[0]).toMatchObject({
      name: "Ledger Stax",
      device_type: "stax",
      mocks: [{ prefix: "ff", responses: ["aa", "bb"] }],
    });
    expect(snapshot.devices[0]).not.toHaveProperty("id");
    expect(snapshot.devices[0]).not.toHaveProperty("connected");
  });

  it("imports a snapshot, replacing devices and their mocks", () => {
    const { store, record } = newSession();
    const old = store.addDevice(record, { name: "Old", device_type: "nanoX" });
    store.addMock(record, old.id, { prefix: "aa", responses: ["00"] });

    const result = store.importSession(record, {
      devices: [
        {
          name: "Imported",
          device_type: "flex",
          mocks: [{ prefix: "ff", responses: ["11", "22"] }],
        },
      ],
    });

    const devices = store.listDevices(record);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe("Imported");

    const mocks = store.listMocks(record, devices[0]!.id)!;
    expect(mocks).toHaveLength(1);
    // Fresh cursor: the imported sequence starts from the beginning.
    expect(store.consumeResponse(record, devices[0]!.id, mocks[0]!)).toBe("11");
    expect(result.devices[0]?.mocks).toEqual([
      { prefix: "ff", responses: ["11", "22"] },
    ]);
  });
});
