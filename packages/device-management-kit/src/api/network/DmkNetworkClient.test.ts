import { DmkNetworkClient } from "./DmkNetworkClient";
import { DmkNetworkClientError } from "./DmkNetworkClientError";

describe("DmkNetworkClient", () => {
  const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
      ...init,
    });

  describe("URL composition", () => {
    it("should send requests to an absolute URL as-is", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      await client.get("https://api.example.com/items");

      const [calledUrl] = fetchMock.mock.calls[0]!;
      expect(typeof calledUrl).toBe("string");
      expect(calledUrl).toBe("https://api.example.com/items");
    });

    it("should prepend baseUrl to relative paths with slash normalization", async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
      const client = new DmkNetworkClient({
        baseUrl: "https://api.example.com/",
        fetch: fetchMock,
      });

      await client.get("/items");
      await client.get("items");

      expect(fetchMock.mock.calls[0]![0]).toBe("https://api.example.com/items");
      expect(fetchMock.mock.calls[1]![0]).toBe("https://api.example.com/items");
    });

    it("should set URL search params from the config", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      await client.get("https://api.example.com/items", {
        params: {
          chain: 1,
          contract: "0xabc",
          active: true,
          skip: null,
          alsoSkip: undefined,
        },
      });

      const calledUrl = fetchMock.mock.calls[0]![0] as string;
      expect(typeof calledUrl).toBe("string");
      const url = new URL(calledUrl);
      expect(url.searchParams.get("chain")).toBe("1");
      expect(url.searchParams.get("contract")).toBe("0xabc");
      expect(url.searchParams.get("active")).toBe("true");
      expect(url.searchParams.has("skip")).toBe(false);
      expect(url.searchParams.has("alsoSkip")).toBe(false);
    });
  });

  describe("headers", () => {
    it("should merge default and per-request headers", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = new DmkNetworkClient({
        fetch: fetchMock,
        headers: { "X-Default": "default", "X-Shared": "from-default" },
      });

      await client.get("https://api.example.com/items", {
        headers: { "X-Shared": "overridden", "X-Per-Request": "per" },
      });

      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(init.headers).toMatchObject({
        "X-Default": "default",
        "X-Shared": "overridden",
        "X-Per-Request": "per",
      });
    });
  });

  describe("body handling", () => {
    it("should JSON-stringify plain-object bodies and set Content-Type", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      await client.post("https://api.example.com/items", { foo: "bar" });

      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(init.method).toBe("POST");
      expect(init.body).toBe(JSON.stringify({ foo: "bar" }));
      expect(init.headers).toMatchObject({
        "Content-Type": "application/json",
      });
    });

    it("should not override an explicit Content-Type header", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      await client.post(
        "https://api.example.com/items",
        { foo: "bar" },
        { headers: { "content-type": "application/vnd.custom+json" } },
      );

      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(init.headers).toMatchObject({
        "content-type": "application/vnd.custom+json",
      });
    });

    it("should pass raw BodyInit values through unchanged", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = new DmkNetworkClient({ fetch: fetchMock });
      const formData = new FormData();
      formData.set("field", "value");

      await client.post("https://api.example.com/items", formData);

      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(init.body).toBe(formData);
      expect(init.headers).not.toMatchObject({
        "Content-Type": "application/json",
      });
    });

    it("should not send a body on GET or HEAD", async () => {
      const fetchMock = vi
        .fn()
        .mockImplementation(() => Promise.resolve(jsonResponse({ ok: true })));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      await client.get("https://api.example.com/items");
      await client.head("https://api.example.com/items");

      expect(fetchMock.mock.calls[0]![1]).toMatchObject({ body: undefined });
      expect(fetchMock.mock.calls[1]![1]).toMatchObject({ body: undefined });
    });
  });

  describe("response parsing", () => {
    it("should return the parsed JSON body by default", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse({ hello: "world" }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const result = await client.get("https://api.example.com/items");

      expect(result).toEqual({ hello: "world" });
    });

    it("should return text when responseType is 'text'", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response("plain-body", { status: 200 }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const result = await client.get("https://api.example.com/items", {
        responseType: "text",
      });

      expect(result).toBe("plain-body");
    });

    it("should resolve HEAD to void without reading the body", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 200 }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const result = await client.head("https://api.example.com/items");

      expect(result).toBeUndefined();
    });

    it("should resolve empty JSON body to undefined", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(null, { status: 204 }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const result = await client.get("https://api.example.com/items");

      expect(result).toBeUndefined();
    });

    it("should throw a DmkNetworkClientError on malformed JSON", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response("not-json", { status: 200 }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      await expect(
        client.get("https://api.example.com/items"),
      ).rejects.toBeInstanceOf(DmkNetworkClientError);
    });
  });

  describe("error handling", () => {
    it("should throw DmkNetworkClientError with status on non-2xx responses", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response("boom", {
          status: 500,
          statusText: "Server Error",
        }),
      );
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const error = await client
        .get("https://api.example.com/items")
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(DmkNetworkClientError);
      const dmkError = error as DmkNetworkClientError;
      expect(dmkError.status).toBe(500);
      expect(dmkError.statusText).toBe("Server Error");
      expect(dmkError.responseBody).toBe("boom");
      expect(dmkError.isTimeout).toBe(false);
      expect(dmkError.isAbort).toBe(false);
    });

    it("should not throw when throwOnHttpError is disabled", async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response("boom", { status: 500 }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const response = await client.request({
        method: "GET",
        url: "https://api.example.com/items",
        responseType: "text",
        throwOnHttpError: false,
      });

      expect(response.status).toBe(500);
      expect(response.ok).toBe(false);
      expect(response.data).toBe("boom");
    });

    it("should wrap generic fetch failures into DmkNetworkClientError", async () => {
      const cause = new TypeError("network down");
      const fetchMock = vi.fn().mockRejectedValue(cause);
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const error = await client
        .get("https://api.example.com/items")
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(DmkNetworkClientError);
      expect((error as DmkNetworkClientError).cause).toBe(cause);
    });
  });

  describe("timeout", () => {
    it("should pass an AbortSignal when timeoutMs is configured", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      await client.get("https://api.example.com/items", { timeoutMs: 1000 });

      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it("should not pass a signal when no timeout and no external signal are set", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
      const client = new DmkNetworkClient({ fetch: fetchMock });

      await client.get("https://api.example.com/items");

      const init = fetchMock.mock.calls[0]![1] as RequestInit;
      expect(init.signal).toBeUndefined();
    });

    it("should mark the error as a timeout when fetch rejects with TimeoutError", async () => {
      const timeoutError = new Error("The operation was aborted");
      timeoutError.name = "TimeoutError";
      const fetchMock = vi.fn().mockRejectedValue(timeoutError);
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const error = await client
        .get("https://api.example.com/items", { timeoutMs: 10 })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(DmkNetworkClientError);
      expect((error as DmkNetworkClientError).isTimeout).toBe(true);
      expect((error as DmkNetworkClientError).isAbort).toBe(false);
    });

    it("should mark the error as an abort when the caller signal is aborted", async () => {
      const abortController = new AbortController();
      abortController.abort();
      const abortError = new Error("aborted");
      abortError.name = "AbortError";
      const fetchMock = vi.fn().mockRejectedValue(abortError);
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const error = await client
        .get("https://api.example.com/items", {
          signal: abortController.signal,
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(DmkNetworkClientError);
      expect((error as DmkNetworkClientError).isAbort).toBe(true);
      expect((error as DmkNetworkClientError).isTimeout).toBe(false);
    });
  });

  describe("request envelope", () => {
    it("should expose full response metadata via request()", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ hello: "world" }), {
          status: 201,
          statusText: "Created",
          headers: { "X-Custom": "1", "Content-Type": "application/json" },
        }),
      );
      const client = new DmkNetworkClient({ fetch: fetchMock });

      const response = await client.request({
        method: "GET",
        url: "https://api.example.com/items",
      });

      expect(response.status).toBe(201);
      expect(response.statusText).toBe("Created");
      expect(response.ok).toBe(true);
      expect(response.data).toEqual({ hello: "world" });
      expect(response.headers.get("X-Custom")).toBe("1");
    });
  });
});
