import { afterEach, describe, expect, it, vi } from "vitest";

import { FirmwareUpdateResolver } from "./FirmwareUpdateResolver";

const MANAGER_API_URL = "https://manager.test/api";

const resolver = () =>
  new FirmwareUpdateResolver({ managerApiUrl: MANAGER_API_URL });

const json = (body: unknown): Promise<Response> =>
  Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);

/** Route each Manager API endpoint to a canned response by path. */
const mockFetch = (byPath: Record<string, unknown>) =>
  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = String(input);
    const match = Object.keys(byPath).find((path) => url.includes(path));
    if (!match) throw new Error(`unexpected fetch ${url}`);
    return json(byPath[match]);
  });

describe("FirmwareUpdateResolver", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resolves the clean next final version via the Manager API", async () => {
    const fetchSpy = mockFetch({
      "/get_device_version": { id: 42 },
      "/get_firmware_version": { id: 100 },
      "/get_latest_firmware": {
        result: "ok",
        se_firmware_osu_version: {
          name: "1.9.0-to-1.9.1",
          next_se_firmware_final_version: 101,
        },
      },
      "/firmware_final_versions/101": { id: 101, name: "1.9.1" },
    });

    const resolved = await resolver().resolveNextVersion({
      targetId: "857735172",
      currentVersion: "1.9.0",
    });

    expect(resolved.extract()).toBe("1.9.1");
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("returns empty when the Manager API reports no update", async () => {
    mockFetch({
      "/get_device_version": { id: 42 },
      "/get_firmware_version": { id: 100 },
      "/get_latest_firmware": { result: "null" },
    });

    const resolved = await resolver().resolveNextVersion({
      targetId: "857735172",
      currentVersion: "1.9.0",
    });
    expect(resolved.isNothing()).toBe(true);
  });

  it("returns empty when the target id is unknown", async () => {
    mockFetch({ "/get_device_version": {} });
    const resolved = await resolver().resolveNextVersion({
      targetId: "0",
      currentVersion: "1.9.0",
    });
    expect(resolved.isNothing()).toBe(true);
  });

  it("returns empty when a Manager API call fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    const resolved = await resolver().resolveNextVersion({
      targetId: "857735172",
      currentVersion: "1.9.0",
    });
    expect(resolved.isNothing()).toBe(true);
  });

  it("does not cache transient failures and retries on the next call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("network down"))
      .mockImplementation((input) => {
        const url = String(input);
        if (url.includes("/get_device_version")) return json({ id: 42 });
        if (url.includes("/get_firmware_version")) return json({ id: 100 });
        if (url.includes("/get_latest_firmware")) {
          return json({
            result: "ok",
            se_firmware_osu_version: {
              name: "1.9.0-to-1.9.1",
              next_se_firmware_final_version: 101,
            },
          });
        }
        if (url.includes("/firmware_final_versions/101")) {
          return json({ id: 101, name: "1.9.1" });
        }
        throw new Error(`unexpected fetch ${url}`);
      });

    const instance = resolver();
    const first = await instance.resolveNextVersion({
      targetId: "857735172",
      currentVersion: "1.9.0",
    });
    expect(first.isNothing()).toBe(true);

    const second = await instance.resolveNextVersion({
      targetId: "857735172",
      currentVersion: "1.9.0",
    });
    expect(second.extract()).toBe("1.9.1");
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
  });

  it("caches 5xx responses as transient and retries", async () => {
    const serverError = Promise.resolve({
      ok: false,
      status: 503,
    } as Response);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockReturnValueOnce(serverError)
      .mockImplementation((input) => {
        const url = String(input);
        if (url.includes("/get_device_version")) return json({ id: 42 });
        if (url.includes("/get_firmware_version")) return json({ id: 100 });
        if (url.includes("/get_latest_firmware")) {
          return json({
            result: "ok",
            se_firmware_osu_version: {
              name: "1.9.0-to-1.9.1",
              next_se_firmware_final_version: 101,
            },
          });
        }
        if (url.includes("/firmware_final_versions/101")) {
          return json({ id: 101, name: "1.9.1" });
        }
        throw new Error(`unexpected fetch ${url}`);
      });

    const instance = resolver();
    const first = await instance.resolveNextVersion({
      targetId: "857735172",
      currentVersion: "1.9.0",
    });
    expect(first.isNothing()).toBe(true);

    const second = await instance.resolveNextVersion({
      targetId: "857735172",
      currentVersion: "1.9.0",
    });
    expect(second.extract()).toBe("1.9.1");
    expect(fetchSpy.mock.calls.length).toBeGreaterThan(1);
  });

  describe("resolveCurrentMcuVersion", () => {
    it("resolves the MCU name compatible with the next final firmware", async () => {
      mockFetch({
        "/get_device_version": { id: 42 },
        "/get_firmware_version": { id: 100 },
        "/get_latest_firmware": {
          result: "ok",
          se_firmware_osu_version: {
            name: "1.9.0-to-1.9.1",
            next_se_firmware_final_version: 101,
          },
        },
        "/firmware_final_versions/101": {
          id: 101,
          name: "1.9.1",
          mcu_versions: [55, 56],
        },
        "/mcu_versions": [
          { id: 99, name: "9.9.9" },
          { id: 55, name: "5.32.3" },
        ],
      });

      const resolved = await resolver().resolveCurrentMcuVersion({
        targetId: "857735172",
        currentVersion: "1.9.0",
      });
      expect(resolved.extract()).toBe("5.32.3");
    });

    it("resolves the MCU name from the current firmware when already up to date", async () => {
      mockFetch({
        "/get_device_version": { id: 42 },
        "/get_firmware_version": { id: 100 },
        "/get_latest_firmware": { result: "null" },
        "/firmware_final_versions/100": {
          id: 100,
          name: "1.9.0",
          mcu_versions: [55],
        },
        "/mcu_versions": [{ id: 55, name: "5.32.3" }],
      });

      const resolved = await resolver().resolveCurrentMcuVersion({
        targetId: "857735172",
        currentVersion: "1.9.0",
      });
      expect(resolved.extract()).toBe("5.32.3");
    });

    it("memoizes the lookup per target id and current version", async () => {
      const fetchSpy = mockFetch({
        "/get_device_version": { id: 42 },
        "/get_firmware_version": { id: 100 },
        "/get_latest_firmware": {
          result: "ok",
          se_firmware_osu_version: {
            name: "1.9.0-to-1.9.1",
            next_se_firmware_final_version: 101,
          },
        },
        "/firmware_final_versions/101": {
          id: 101,
          name: "1.9.1",
          mcu_versions: [55],
        },
        "/mcu_versions": [{ id: 55, name: "5.32.3" }],
      });

      const instance = resolver();
      await instance.resolveCurrentMcuVersion({
        targetId: "857735172",
        currentVersion: "1.9.0",
      });
      const callsAfterFirst = fetchSpy.mock.calls.length;
      await instance.resolveCurrentMcuVersion({
        targetId: "857735172",
        currentVersion: "1.9.0",
      });
      expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
    });
  });
});
