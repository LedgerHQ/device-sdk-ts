import { afterEach, vi } from "vitest";

import { SpeculinhoClient } from "./SpeculinhoClient";

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as unknown as Response;

const newClient = () =>
  new SpeculinhoClient({
    baseUrl: "https://speculinho.test/",
    seed: "test seed",
    pollIntervalMs: 0,
    readyTimeoutMs: 1_000,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("SpeculinhoClient", () => {
  it("posts the acquire body with seed and run_id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ run_id: "run-1", status: "pending" }));

    const runId = await newClient().acquire(
      {
        coin_app: "btc",
        coin_app_version: "2.1.0",
        device: "nanox",
        device_os_version: "1.3.0",
      },
      "run-1",
    );

    expect(runId).toBe("run-1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://speculinho.test/acquire");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      coin_app: "btc",
      coin_app_version: "2.1.0",
      device: "nanox",
      device_os_version: "1.3.0",
      seed: "test seed",
      run_id: "run-1",
    });
  });

  it("throws when acquire is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "conflict" }, false, 409),
    );
    await expect(
      newClient().acquire(
        {
          coin_app: "btc",
          coin_app_version: "2.1.0",
          device: "nanox",
          device_os_version: "1.3.0",
        },
        "run-1",
      ),
    ).rejects.toThrow(/acquire failed \(409\)/);
  });

  it("polls until ready and returns the speculos url", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ run_id: "r", status: "pending" }))
      .mockResolvedValueOnce(
        jsonResponse({
          run_id: "r",
          status: "ready",
          speculos_url: "https://r.speculos.test",
        }),
      );

    await expect(newClient().waitUntilReady("r")).resolves.toBe(
      "https://r.speculos.test",
    );
  });

  it("throws when the run fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ run_id: "r", status: "failed", error_details: "boom" }),
    );
    await expect(newClient().waitUntilReady("r")).rejects.toThrow(/boom/);
  });

  it("throws when readiness times out", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ run_id: "r", status: "pending" }),
    );
    const client = new SpeculinhoClient({
      baseUrl: "https://speculinho.test",
      seed: "s",
      pollIntervalMs: 0,
      readyTimeoutMs: 0,
    });
    await expect(client.waitUntilReady("r")).rejects.toThrow(/not ready/);
  });

  it("forwards an APDU to the speculos pod and returns its data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ data: "9000" }));

    const response = await newClient().forwardApdu(
      "https://r.speculos.test/",
      "b001000000",
    );

    expect(response).toBe("9000");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://r.speculos.test/apdu");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      data: "b001000000",
    });
  });

  it("swallows release errors", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    await expect(newClient().release("r")).resolves.toBeUndefined();
  });
});
