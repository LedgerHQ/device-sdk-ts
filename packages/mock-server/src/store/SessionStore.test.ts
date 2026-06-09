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
});
