import { InMemorySessionRepository } from "@internal/session/data/InMemorySessionRepository";

const newSession = () => {
  const repo = new InMemorySessionRepository({});
  const { token } = repo.createSession();
  const record = repo.findByToken(token).unsafeCoerce();
  return { repo, record };
};

describe("InMemorySessionRepository", () => {
  it("creates a session with no devices", () => {
    const { repo, record } = newSession();
    expect(repo.listDevices(record)).toHaveLength(0);
  });

  it("resolves a session from its token and rejects unknown tokens", () => {
    const repo = new InMemorySessionRepository({});
    const { token } = repo.createSession();
    expect(repo.findByToken(token).isJust()).toBe(true);
    expect(repo.findByToken("nope").isNothing()).toBe(true);
  });

  it("expires sessions past their TTL and sweeps them", () => {
    const repo = new InMemorySessionRepository({ ttlMs: -1 });
    repo.createSession();
    expect(repo.size()).toBe(1);
    expect(repo.sweep()).toEqual([]);
    expect(repo.size()).toBe(0);
  });

  it("returns evicted speculos proxies on session/device removal and sweep", () => {
    const repo = new InMemorySessionRepository({});
    const { token } = repo.createSession();
    const record = repo.findByToken(token).unsafeCoerce();
    const device = repo.addDevice(record, { device_type: "nanoX" });
    repo.setProxy(record, device.id, {
      runId: "run-1",
      speculosUrl: "https://run-1.speculos.test",
      appName: "Bitcoin",
    });
    // Device removal returns the proxy.
    const { proxy } = repo.deleteDevice(record, device.id);
    expect(proxy.extract()?.runId).toBe("run-1");
  });

  it("toggles connection state", () => {
    const { repo, record } = newSession();
    const device = repo.addDevice(record, { device_type: "nanoX" });
    expect(
      repo.setConnected(record, device.id, true).extract()?.connected,
    ).toBe(true);
    expect(
      repo.setConnected(record, device.id, false).extract()?.connected,
    ).toBe(false);
  });

  it("starts a new device with an empty mock table", () => {
    const { repo, record } = newSession();
    const device = repo.addDevice(record, { device_type: "nanoX" });
    expect(repo.listMocks(record, device.id).extract()).toEqual([]);
  });

  it("seeds mocks from the device config (import path)", () => {
    const { repo, record } = newSession();
    const device = repo.addDevice(record, {
      device_type: "nanoX",
      mocks: [{ prefix: "ff", response: "9000" }],
    });
    const mocks = repo.listMocks(record, device.id).unsafeCoerce();
    expect(mocks).toHaveLength(1);
    expect(mocks[0]).toMatchObject({ prefix: "ff", responses: ["9000"] });
  });

  it("returns Nothing for mocks of an unknown device", () => {
    const { repo, record } = newSession();
    expect(repo.listMocks(record, "nope").isNothing()).toBe(true);
    expect(
      repo
        .addMock(record, "nope", { prefix: "ff", response: "00" })
        .isNothing(),
    ).toBe(true);
  });

  it("manages a device's mocks independently", () => {
    const { repo, record } = newSession();
    const a = repo.addDevice(record, { device_type: "nanoX" });
    const b = repo.addDevice(record, { device_type: "stax" });

    repo.addMock(record, a.id, { prefix: "aa", response: "9000" });
    expect(repo.listMocks(record, a.id).unsafeCoerce()).toHaveLength(1);
    expect(repo.listMocks(record, b.id).unsafeCoerce()).toHaveLength(0);

    repo.clearMocks(record, a.id);
    expect(repo.listMocks(record, a.id).unsafeCoerce()).toHaveLength(0);
  });

  it("serves queued responses in order and loops once exhausted", () => {
    const { repo, record } = newSession();
    const device = repo.addDevice(record, { device_type: "nanoX" });
    const mock = repo
      .addMock(record, device.id, {
        prefix: "ff",
        responses: ["aa", "bb", "cc"],
      })
      .unsafeCoerce();

    expect(repo.consumeResponse(record, device.id, mock)).toBe("aa");
    expect(repo.consumeResponse(record, device.id, mock)).toBe("bb");
    expect(repo.consumeResponse(record, device.id, mock)).toBe("cc");
    expect(repo.consumeResponse(record, device.id, mock)).toBe("aa");
  });

  it("restarts a mock's sequence when it is edited", () => {
    const { repo, record } = newSession();
    const device = repo.addDevice(record, { device_type: "nanoX" });
    const mock = repo
      .addMock(record, device.id, { prefix: "ff", responses: ["aa", "bb"] })
      .unsafeCoerce();
    expect(repo.consumeResponse(record, device.id, mock)).toBe("aa");

    const edited = repo
      .editMock(record, device.id, mock.id, {
        prefix: "ff",
        responses: ["11", "22"],
      })
      .unsafeCoerce();
    expect(repo.consumeResponse(record, device.id, edited)).toBe("11");
  });

  it("drops a device's mocks when the device is removed", () => {
    const { repo, record } = newSession();
    const device = repo.addDevice(record, { device_type: "nanoX" });
    repo.addMock(record, device.id, { prefix: "ff", response: "9000" });

    repo.deleteDevice(record, device.id);
    expect(repo.listMocks(record, device.id).isNothing()).toBe(true);
  });

  it("exports devices with their mocks nested (config-only)", () => {
    const { repo, record } = newSession();
    const device = repo.addDevice(record, {
      name: "Ledger Stax",
      device_type: "stax",
    });
    repo.addMock(record, device.id, { prefix: "ff", responses: ["aa", "bb"] });

    const snapshot = repo.exportSession(record);
    expect(snapshot).not.toHaveProperty("mocks");
    expect(snapshot.devices[0]).toMatchObject({
      name: "Ledger Stax",
      device_type: "stax",
      mocks: [{ prefix: "ff", responses: ["aa", "bb"] }],
    });
    expect(snapshot.devices[0]).not.toHaveProperty("id");
  });

  it("imports a snapshot, replacing devices and their mocks", () => {
    const { repo, record } = newSession();
    const old = repo.addDevice(record, { name: "Old", device_type: "nanoX" });
    repo.addMock(record, old.id, { prefix: "aa", responses: ["00"] });

    const result = repo.importSession(record, {
      devices: [
        {
          name: "Imported",
          device_type: "flex",
          mocks: [{ prefix: "ff", responses: ["11", "22"] }],
        },
      ],
    });

    const devices = repo.listDevices(record);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe("Imported");
    expect(result.devices[0]?.mocks).toEqual([
      { prefix: "ff", responses: ["11", "22"] },
    ]);
  });

  // --- App store (catalog) / pending app operations --------------------------

  const BTC = { hash: "abc123", name: "Bitcoin", version: "2.1.0" };

  it("seeds the app store catalog from the device config (exact hash lookup)", () => {
    const { repo, record } = newSession();
    repo.addDevice(record, { device_type: "nanoX", catalog: [BTC] });
    expect(repo.findCatalogAppByHash(record, "abc123").extract()).toEqual(BTC);
    expect(repo.findCatalogAppByHash(record, "unknown").isNothing()).toBe(true);
  });

  it("toggles a pending app operation: install when absent, uninstall when present", () => {
    const { repo, record } = newSession();
    const device = repo.addDevice(record, {
      device_type: "nanoX",
      apps: [{ name: "BOLOS", version: "1.5.0" }],
    });

    // Nothing pending: no-op.
    expect(repo.commitPendingAppOperation(record, device.id).isNothing()).toBe(
      true,
    );

    // Bitcoin absent -> install (add).
    repo.setPendingAppOperation(record, device.id, BTC);
    const installed = repo
      .commitPendingAppOperation(record, device.id)
      .unsafeCoerce();
    expect(installed.apps).toEqual([
      { name: "BOLOS", version: "1.5.0" },
      { name: "Bitcoin", version: "2.1.0", hash: "abc123" },
    ]);

    // Pending was cleared.
    expect(repo.commitPendingAppOperation(record, device.id).isNothing()).toBe(
      true,
    );

    // Bitcoin present -> uninstall (remove).
    repo.setPendingAppOperation(record, device.id, BTC);
    const uninstalled = repo
      .commitPendingAppOperation(record, device.id)
      .unsafeCoerce();
    expect(uninstalled.apps).toEqual([{ name: "BOLOS", version: "1.5.0" }]);
  });
});
