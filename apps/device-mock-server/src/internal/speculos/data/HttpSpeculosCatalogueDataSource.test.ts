import { afterEach, vi } from "vitest";

import { HttpSpeculosCatalogueDataSource } from "@internal/speculos/data/HttpSpeculosCatalogueDataSource";

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
  ({
    ok,
    status,
    json: () => Promise.resolve(body),
  }) as unknown as Response;

const CATALOGUE = {
  devices: {
    stax: {
      firmware: {
        "1.10.1": { Ethereum: ["1.22.3"], Solana: ["1.16.0"] },
      },
    },
  },
};

const newCatalogue = () =>
  new HttpSpeculosCatalogueDataSource({ baseUrl: "https://speculinho.test/" });

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HttpSpeculosCatalogueDataSource", () => {
  it("narrows the catalogue to one model and OS", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(CATALOGUE));

    const result = await newCatalogue().appVersions("stax", "1.10.1").run();

    expect(result.extract()).toEqual({
      Ethereum: ["1.22.3"],
      Solana: ["1.16.0"],
    });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://speculinho.test/catalogue",
    );
  });

  it("answers no apps for a model or OS the catalogue does not carry", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(CATALOGUE));
    const catalogue = newCatalogue();

    expect(
      (await catalogue.appVersions("stax", "9.9.9").run()).extract(),
    ).toEqual({});
    expect(
      (await catalogue.appVersions("flex", "1.10.1").run()).extract(),
    ).toEqual({});
  });

  it("lists the firmware versions of a model, none for one it lacks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(CATALOGUE));
    const catalogue = newCatalogue();

    expect((await catalogue.firmwareVersions("stax").run()).extract()).toEqual([
      "1.10.1",
    ]);
    expect((await catalogue.firmwareVersions("flex").run()).extract()).toEqual(
      [],
    );
  });

  it("fetches the catalogue once across lookups", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(CATALOGUE));
    const catalogue = newCatalogue();

    await catalogue.appVersions("stax", "1.10.1").run();
    await catalogue.appVersions("stax", "1.10.1").run();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one request between concurrent first lookups", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(CATALOGUE));
    const catalogue = newCatalogue();

    await Promise.all([
      catalogue.appVersions("stax", "1.10.1").run(),
      catalogue.firmwareVersions("stax").run(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed fetch", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValue(jsonResponse(CATALOGUE));
    const catalogue = newCatalogue();

    expect((await catalogue.firmwareVersions("stax").run()).isLeft()).toBe(
      true,
    );
    expect((await catalogue.firmwareVersions("stax").run()).extract()).toEqual([
      "1.10.1",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails on a non-OK answer", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({}, false, 503),
    );

    const result = await newCatalogue().appVersions("stax", "1.10.1").run();

    expect(result.isLeft()).toBe(true);
  });

  it("fails when Speculinho is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await newCatalogue().appVersions("stax", "1.10.1").run();

    expect(result.isLeft()).toBe(true);
  });

  it("fails when Speculinho does not answer in time", async () => {
    const timeout = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeout.signal);
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );

    const pending = newCatalogue().appVersions("stax", "1.10.1").run();
    timeout.abort(new DOMException("timed out", "TimeoutError"));
    const result = await pending;

    expect(timeoutSpy).toHaveBeenCalledWith(15_000);
    expect(result.isLeft()).toBe(true);
  });
});
