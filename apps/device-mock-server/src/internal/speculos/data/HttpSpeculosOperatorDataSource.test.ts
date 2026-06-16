import { afterEach, vi } from "vitest";

import { HttpSpeculosOperatorDataSource } from "@internal/speculos/data/HttpSpeculosOperatorDataSource";

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }) as unknown as Response;

const newOperator = () =>
  new HttpSpeculosOperatorDataSource({
    baseUrl: "https://speculinho.test/",
    seed: "test seed",
    pollIntervalMs: 0,
    readyTimeoutMs: 1_000,
  });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HttpSpeculosOperatorDataSource", () => {
  it("posts the acquire body with seed and run_id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ run_id: "run-1", status: "pending" }));

    const result = await newOperator()
      .acquire(
        {
          coin_app: "btc",
          coin_app_version: "2.1.0",
          device: "nanox",
          device_os_version: "1.3.0",
        },
        "run-1",
      )
      .run();

    expect(result.isRight()).toBe(true);
    expect(result.extract()).toBe("run-1");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://speculinho.test/acquire");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
      coin_app: "btc",
      device: "nanox",
      seed: "test seed",
      run_id: "run-1",
    });
  });

  it("returns Left when acquire is rejected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ error: "conflict" }, false, 409),
    );
    const result = await newOperator()
      .acquire(
        {
          coin_app: "btc",
          coin_app_version: "2.1.0",
          device: "nanox",
          device_os_version: "1.3.0",
        },
        "run-1",
      )
      .run();
    expect(result.isLeft()).toBe(true);
    expect(result.leftToMaybe().extract()?.message).toMatch(
      /acquire failed \(409\)/,
    );
  });

  it("polls until ready and resolves the speculos url", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ run_id: "r", status: "pending" }))
      .mockResolvedValueOnce(
        jsonResponse({
          run_id: "r",
          status: "ready",
          speculos_url: "https://r.speculos.test",
        }),
      );

    const result = await newOperator().waitUntilReady("r").run();
    expect(result.extract()).toBe("https://r.speculos.test");
  });

  it("returns Left when the run fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ run_id: "r", status: "failed", error_details: "boom" }),
    );
    const result = await newOperator().waitUntilReady("r").run();
    expect(result.isLeft()).toBe(true);
    expect(result.leftToMaybe().extract()?.message).toMatch(/boom/);
  });

  it("forwards an APDU and resolves its data", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ data: "9000" }));

    const result = await newOperator()
      .forwardApdu("https://r.speculos.test/", "b001000000")
      .run();

    expect(result.extract()).toBe("9000");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://r.speculos.test/apdu");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      data: "b001000000",
    });
  });

  it("swallows release errors (best-effort)", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const result = await newOperator().release("r").run();
    expect(result.isRight()).toBe(true);
  });

  it("proxies a raw request and relays status/content-type/body", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
      headers: { get: () => "image/png" },
      arrayBuffer: () =>
        Promise.resolve(
          Uint8Array.from(Buffer.from("PNG-BYTES")).buffer as ArrayBuffer,
        ),
    } as unknown as Response);

    const result = await newOperator()
      .proxyRequest("https://r.speculos.test/", {
        method: "POST",
        path: "button/right",
        query: "?delay=0",
        body: { action: "press-and-release" },
        hasBody: true,
      })
      .run();

    expect(result.extract()).toEqual({
      status: 200,
      contentType: "image/png",
      body: Buffer.from("PNG-BYTES"),
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://r.speculos.test/button/right?delay=0");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      action: "press-and-release",
    });
  });

  it("returns Left when the proxied request throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    const result = await newOperator()
      .proxyRequest("https://r.speculos.test/", {
        method: "GET",
        path: "screenshot",
        query: "",
        body: null,
        hasBody: false,
      })
      .run();
    expect(result.isLeft()).toBe(true);
    expect(result.leftToMaybe().extract()?.message).toMatch(
      /speculos proxy request failed/,
    );
  });
});
