import { DmkNetworkClientError } from "./DmkNetworkClientError";
import {
  buildBodyAndHeaders,
  buildSignal,
  buildUrl,
  hasHeader,
  isRawBody,
  joinPath,
  JSON_CONTENT_TYPE,
  parseBody,
  safeReadText,
  wrapFetchError,
} from "./DmkNetworkClientHelpers";

describe("DmkNetworkClientHelpers", () => {
  describe("joinPath", () => {
    it("should return the base when the path is empty", () => {
      expect(joinPath("https://api.example.com", "")).toBe(
        "https://api.example.com",
      );
    });

    it("should insert a single slash when neither side has one", () => {
      expect(joinPath("https://api.example.com", "items")).toBe(
        "https://api.example.com/items",
      );
    });

    it("should collapse a trailing base slash with a leading path slash", () => {
      expect(joinPath("https://api.example.com/", "/items")).toBe(
        "https://api.example.com/items",
      );
    });

    it("should keep a single slash when only one side has one", () => {
      expect(joinPath("https://api.example.com/", "items")).toBe(
        "https://api.example.com/items",
      );
      expect(joinPath("https://api.example.com", "/items")).toBe(
        "https://api.example.com/items",
      );
    });
  });

  describe("buildUrl", () => {
    it("should keep an absolute URL as-is", () => {
      const url = buildUrl({ url: "https://api.example.com/items" });
      expect(url.toString()).toBe("https://api.example.com/items");
    });

    it("should prepend the base URL to a relative path", () => {
      const url = buildUrl({
        url: "/items",
        baseUrl: "https://api.example.com/",
      });
      expect(url.toString()).toBe("https://api.example.com/items");
    });

    it("should ignore the base URL when the input URL is absolute", () => {
      const url = buildUrl({
        url: "https://other.example.com/items",
        baseUrl: "https://api.example.com",
      });
      expect(url.toString()).toBe("https://other.example.com/items");
    });

    it("should append query params and skip null/undefined entries", () => {
      const url = buildUrl({
        url: "https://api.example.com/items",
        params: {
          chain: 1,
          contract: "0xabc",
          active: true,
          skip: null,
          alsoSkip: undefined,
        },
      });
      expect(url.searchParams.get("chain")).toBe("1");
      expect(url.searchParams.get("contract")).toBe("0xabc");
      expect(url.searchParams.get("active")).toBe("true");
      expect(url.searchParams.has("skip")).toBe(false);
      expect(url.searchParams.has("alsoSkip")).toBe(false);
    });
  });

  describe("hasHeader", () => {
    it("should find a header regardless of case", () => {
      expect(hasHeader({ "Content-Type": "json" }, "content-type")).toBe(true);
      expect(hasHeader({ "content-type": "json" }, "Content-Type")).toBe(true);
    });

    it("should return false when no matching header exists", () => {
      expect(hasHeader({ Accept: "json" }, "content-type")).toBe(false);
      expect(hasHeader({}, "content-type")).toBe(false);
    });
  });

  describe("isRawBody", () => {
    it("should accept native BodyInit values", () => {
      expect(isRawBody("raw-string")).toBe(true);
      expect(isRawBody(new ArrayBuffer(4))).toBe(true);
      expect(isRawBody(new Uint8Array([1, 2, 3]))).toBe(true);
      expect(isRawBody(new Blob(["a"]))).toBe(true);
      expect(isRawBody(new FormData())).toBe(true);
      expect(isRawBody(new URLSearchParams({ a: "1" }))).toBe(true);
      expect(isRawBody(new ReadableStream())).toBe(true);
    });

    it("should reject plain objects and primitives", () => {
      expect(isRawBody({ foo: "bar" })).toBe(false);
      expect(isRawBody([1, 2, 3])).toBe(false);
      expect(isRawBody(42)).toBe(false);
      expect(isRawBody(null)).toBe(false);
      expect(isRawBody(undefined)).toBe(false);
    });
  });

  describe("buildBodyAndHeaders", () => {
    it("should merge default and per-request headers with per-request winning", () => {
      const { headers } = buildBodyAndHeaders({
        method: "GET",
        body: undefined,
        defaultHeaders: { "X-Default": "default", "X-Shared": "from-default" },
        perRequestHeaders: { "X-Shared": "overridden", "X-Per": "per" },
      });
      expect(headers).toEqual({
        "X-Default": "default",
        "X-Shared": "overridden",
        "X-Per": "per",
      });
    });

    it("should not emit a body on GET/HEAD even when a body is provided", () => {
      const result = buildBodyAndHeaders({
        method: "GET",
        body: { foo: "bar" },
        defaultHeaders: {},
      });
      expect(result.body).toBeUndefined();
      expect(result.headers["Content-Type"]).toBeUndefined();
    });

    it("should JSON-stringify plain objects and set the Content-Type", () => {
      const result = buildBodyAndHeaders({
        method: "POST",
        body: { foo: "bar" },
        defaultHeaders: {},
      });
      expect(result.body).toBe(JSON.stringify({ foo: "bar" }));
      expect(result.headers["Content-Type"]).toBe(JSON_CONTENT_TYPE);
    });

    it("should not override an explicit Content-Type header", () => {
      const result = buildBodyAndHeaders({
        method: "POST",
        body: { foo: "bar" },
        defaultHeaders: {},
        perRequestHeaders: { "content-type": "application/vnd.custom+json" },
      });
      expect(result.body).toBe(JSON.stringify({ foo: "bar" }));
      expect(result.headers["content-type"]).toBe(
        "application/vnd.custom+json",
      );
      expect(result.headers["Content-Type"]).toBeUndefined();
    });

    it("should pass raw BodyInit values through unchanged without JSON headers", () => {
      const formData = new FormData();
      formData.set("field", "value");
      const result = buildBodyAndHeaders({
        method: "POST",
        body: formData,
        defaultHeaders: {},
      });
      expect(result.body).toBe(formData);
      expect(result.headers["Content-Type"]).toBeUndefined();
    });

    it("should return an undefined body when the body itself is undefined", () => {
      const result = buildBodyAndHeaders({
        method: "POST",
        body: undefined,
        defaultHeaders: { "X-Default": "d" },
      });
      expect(result.body).toBeUndefined();
      expect(result.headers).toEqual({ "X-Default": "d" });
    });
  });

  describe("buildSignal", () => {
    it("should return undefined when no timeout and no external signal", () => {
      expect(
        buildSignal({
          perRequestTimeoutMs: undefined,
          defaultTimeoutMs: undefined,
          externalSignal: undefined,
        }),
      ).toBeUndefined();
    });

    it("should return undefined when timeouts are zero and no external signal", () => {
      expect(
        buildSignal({
          perRequestTimeoutMs: 0,
          defaultTimeoutMs: 1000,
          externalSignal: undefined,
        }),
      ).toBeUndefined();
    });

    it("should return the external signal alone when no timeout is configured", () => {
      const controller = new AbortController();
      const signal = buildSignal({
        perRequestTimeoutMs: undefined,
        defaultTimeoutMs: undefined,
        externalSignal: controller.signal,
      });
      expect(signal).toBe(controller.signal);
    });

    it("should return a timeout signal when only a timeout is configured", () => {
      const signal = buildSignal({
        perRequestTimeoutMs: undefined,
        defaultTimeoutMs: 1000,
        externalSignal: undefined,
      });
      expect(signal).toBeInstanceOf(AbortSignal);
    });

    it("should prefer the per-request timeout over the default", () => {
      const anySpy = vi.spyOn(AbortSignal, "timeout");
      buildSignal({
        perRequestTimeoutMs: 50,
        defaultTimeoutMs: 1000,
        externalSignal: undefined,
      });
      expect(anySpy).toHaveBeenCalledWith(50);
      anySpy.mockRestore();
    });

    it("should compose both signals with AbortSignal.any when both are set", () => {
      const anySpy = vi.spyOn(AbortSignal, "any");
      const controller = new AbortController();
      const signal = buildSignal({
        perRequestTimeoutMs: 100,
        defaultTimeoutMs: undefined,
        externalSignal: controller.signal,
      });
      expect(signal).toBeInstanceOf(AbortSignal);
      expect(anySpy).toHaveBeenCalledTimes(1);
      anySpy.mockRestore();
    });
  });

  describe("parseBody", () => {
    it("should return undefined for 'void' response type without consuming the body", async () => {
      const response = new Response("ignored");
      const result = await parseBody(response, "void");
      expect(result).toBeUndefined();
      expect(response.bodyUsed).toBe(false);
    });

    it("should return text for 'text' response type", async () => {
      const response = new Response("plain-body");
      await expect(parseBody(response, "text")).resolves.toBe("plain-body");
    });

    it("should return a Blob for 'blob' response type", async () => {
      const response = new Response("blob-body");
      const result = await parseBody(response, "blob");
      expect(result).toBeInstanceOf(Blob);
    });

    it("should return an ArrayBuffer for 'arrayBuffer' response type", async () => {
      const response = new Response(new Uint8Array([1, 2, 3]));
      const result = await parseBody(response, "arrayBuffer");
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(new Uint8Array(result as ArrayBuffer)).toEqual(
        new Uint8Array([1, 2, 3]),
      );
    });

    it("should parse JSON for 'json' response type", async () => {
      const response = new Response(JSON.stringify({ hello: "world" }));
      await expect(parseBody(response, "json")).resolves.toEqual({
        hello: "world",
      });
    });

    it("should resolve to undefined for an empty JSON body", async () => {
      const response = new Response("");
      await expect(parseBody(response, "json")).resolves.toBeUndefined();
    });

    it("should throw a DmkNetworkClientError for malformed JSON", async () => {
      const response = new Response("not-json", {
        status: 200,
        statusText: "OK",
      });
      const error = await parseBody(response, "json").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DmkNetworkClientError);
      const dmkError = error as DmkNetworkClientError;
      expect(dmkError.status).toBe(200);
      expect(dmkError.statusText).toBe("OK");
      expect(dmkError.responseBody).toBe("not-json");
      expect(dmkError.cause).toBeInstanceOf(SyntaxError);
    });
  });

  describe("safeReadText", () => {
    it("should return the text body", async () => {
      await expect(safeReadText(new Response("hello"))).resolves.toBe("hello");
    });

    it("should return undefined when reading the body throws", async () => {
      const response = {
        text: () => Promise.reject(new Error("read failed")),
      } as unknown as Response;
      await expect(safeReadText(response)).resolves.toBeUndefined();
    });
  });

  describe("wrapFetchError", () => {
    it("should wrap a generic Error with its message", () => {
      const cause = new TypeError("network down");
      const error = wrapFetchError({
        cause,
        externalSignal: undefined,
        perRequestTimeoutMs: undefined,
        defaultTimeoutMs: undefined,
      });
      expect(error).toBeInstanceOf(DmkNetworkClientError);
      expect(error.message).toBe("network down");
      expect(error.cause).toBe(cause);
      expect(error.isTimeout).toBe(false);
      expect(error.isAbort).toBe(false);
    });

    it("should fall back to a generic message for non-Error causes", () => {
      const error = wrapFetchError({
        cause: "something",
        externalSignal: undefined,
        perRequestTimeoutMs: undefined,
        defaultTimeoutMs: undefined,
      });
      expect(error.message).toBe("Network request failed");
      expect(error.cause).toBe("something");
    });

    it("should flag TimeoutError as a timeout", () => {
      const cause = new Error("timed out");
      cause.name = "TimeoutError";
      const error = wrapFetchError({
        cause,
        externalSignal: undefined,
        perRequestTimeoutMs: 10,
        defaultTimeoutMs: undefined,
      });
      expect(error.isTimeout).toBe(true);
      expect(error.isAbort).toBe(false);
      expect(error.message).toBe("Request timed out");
    });

    it("should flag AbortError as a timeout when a timeout is configured and no external abort", () => {
      const cause = new Error("aborted");
      cause.name = "AbortError";
      const error = wrapFetchError({
        cause,
        externalSignal: undefined,
        perRequestTimeoutMs: undefined,
        defaultTimeoutMs: 1000,
      });
      expect(error.isTimeout).toBe(true);
      expect(error.isAbort).toBe(false);
    });

    it("should flag AbortError as an external abort when the caller signal is aborted", () => {
      const controller = new AbortController();
      controller.abort();
      const cause = new Error("aborted");
      cause.name = "AbortError";
      const error = wrapFetchError({
        cause,
        externalSignal: controller.signal,
        perRequestTimeoutMs: undefined,
        defaultTimeoutMs: undefined,
      });
      expect(error.isAbort).toBe(true);
      expect(error.isTimeout).toBe(false);
      expect(error.message).toBe("Request aborted");
    });

    it("should treat AbortError with no timeout and no external abort as a plain abort", () => {
      const cause = new Error("aborted");
      cause.name = "AbortError";
      const error = wrapFetchError({
        cause,
        externalSignal: undefined,
        perRequestTimeoutMs: undefined,
        defaultTimeoutMs: undefined,
      });
      expect(error.isTimeout).toBe(false);
      expect(error.isAbort).toBe(false);
      expect(error.message).toBe("Request aborted");
    });
  });
});
