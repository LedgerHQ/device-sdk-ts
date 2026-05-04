import { DmkNetworkClientError } from "./DmkNetworkClientError";

export type DmkQueryParamValue = string | number | boolean | null | undefined;

export type DmkQueryParams = Record<string, DmkQueryParamValue>;

export type DmkResponseType = "json" | "text" | "blob" | "arrayBuffer" | "void";

export const JSON_CONTENT_TYPE = "application/json";

/**
 * Joins a base URL with a relative path, normalizing surrounding slashes so
 * that exactly one `/` appears between them.
 */
export function joinPath(base: string, path: string): string {
  if (!path) return base;
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${trimmedPath}`;
}

/**
 * Serializes a {@link DmkQueryParams} object into a percent-encoded
 * (RFC 3986) query string (without the leading `?`). `null`/`undefined`
 * entries are skipped.
 *
 * Note: this is not strictly `application/x-www-form-urlencoded` — spaces
 * are encoded as `%20` (via `encodeURIComponent`) rather than `+`. Any
 * RFC 3986-compliant server will decode both forms identically.
 *
 * Implemented manually rather than via `URLSearchParams` so it works on
 * runtimes where `URLSearchParams.set` is not implemented (e.g. some
 * React Native versions).
 */
function serializeParams(params: DmkQueryParams): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }
  return parts.join("&");
}

/**
 * Builds the final request URL from an input URL (absolute or relative), an
 * optional base URL, and optional query params. `null`/`undefined` param
 * values are skipped.
 *
 * Query params are serialized manually (see {@link serializeParams}) instead
 * of via `URL.searchParams`, because some runtimes (notably React Native)
 * ship a `URLSearchParams` whose mutation methods (`set`, `append`, …) are
 * not implemented.
 *
 * @remarks
 * Fragments (`#...`) in the input URL are not supported when `params` is
 * provided: the query string is concatenated after the fragment, so it ends
 * up parsed as part of `.hash` rather than `.search`. Callers should strip
 * or avoid fragments on URLs passed to this function.
 *
 * @remarks
 * If `url` already contains a query string, `params` are appended to it.
 * Keys present in both the existing query string and `params` are not merged:
 * both occurrences will appear in the final URL. Callers relying on override
 * semantics should pre-merge their parameters.
 */
export function buildUrl(args: {
  url: string;
  params?: DmkQueryParams;
  baseUrl?: string;
}): URL {
  const { url, params, baseUrl } = args;
  const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(url);
  const composed = isAbsolute ? url : baseUrl ? joinPath(baseUrl, url) : url;

  const query = params ? serializeParams(params) : "";
  if (query.length === 0) {
    return new URL(composed);
  }

  const separator = composed.includes("?") ? "&" : "?";
  return new URL(`${composed}${separator}${query}`);
}

/**
 * Case-insensitive lookup for a header name in a plain record.
 */
export function hasHeader(
  headers: Record<string, string>,
  name: string,
): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((k) => k.toLowerCase() === lower);
}

/**
 * Returns `true` when the value is already a `BodyInit` accepted by `fetch`
 * and should be passed through without JSON serialization.
 *
 * Each Web-global `instanceof` check is guarded with a `typeof` test so the
 * function is safe on runtimes (e.g. some React Native versions) where
 * `Blob`, `FormData`, `URLSearchParams` or `ReadableStream` are not defined.
 */
export function isRawBody(body: unknown): body is BodyInit {
  if (typeof body === "string") return true;
  if (body instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(body)) return true;
  if (typeof Blob !== "undefined" && body instanceof Blob) return true;
  if (typeof FormData !== "undefined" && body instanceof FormData) return true;
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams)
    return true;
  if (typeof ReadableStream !== "undefined" && body instanceof ReadableStream)
    return true;
  return false;
}

/**
 * Computes the final request body and merged headers. Plain-object bodies are
 * JSON-serialized and the `Content-Type` header is set (unless the caller
 * already provided one). Raw `BodyInit` values pass through unchanged.
 */
export function buildBodyAndHeaders(args: {
  method: string;
  body: unknown;
  defaultHeaders: Record<string, string>;
  perRequestHeaders?: Record<string, string>;
}): { body?: BodyInit; headers: Record<string, string> } {
  const { method, body, defaultHeaders, perRequestHeaders } = args;
  const headers: Record<string, string> = {
    ...defaultHeaders,
    ...perRequestHeaders,
  };

  if (body === undefined || method === "GET" || method === "HEAD") {
    return { body: undefined, headers };
  }

  if (isRawBody(body)) {
    return { body, headers };
  }

  if (!hasHeader(headers, "content-type")) {
    headers["Content-Type"] = JSON_CONTENT_TYPE;
  }
  return { body: JSON.stringify(body), headers };
}

/**
 * Composes the effective abort signal for a request. If both a timeout and an
 * external signal are present, they are merged via `AbortSignal.any` so that
 * either one firing aborts the request.
 */
export function buildSignal(args: {
  timeoutMs: number | undefined;
  externalSignal: AbortSignal | undefined;
}): AbortSignal | undefined {
  const { timeoutMs, externalSignal } = args;
  const timeoutSignal =
    timeoutMs && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

  if (timeoutSignal && externalSignal) {
    return AbortSignal.any([externalSignal, timeoutSignal]);
  }
  return timeoutSignal ?? externalSignal;
}

/**
 * Parses the response body according to the requested {@link DmkResponseType}.
 * Empty JSON bodies resolve to `undefined`; malformed JSON throws a
 * {@link DmkNetworkClientError}.
 */
export async function parseBody(
  response: Response,
  responseType: DmkResponseType,
): Promise<unknown> {
  switch (responseType) {
    case "void":
      return undefined;
    case "text":
      return await response.text();
    case "blob":
      return await response.blob();
    case "arrayBuffer":
      return await response.arrayBuffer();
    case "json":
    default: {
      const text = await response.text();
      if (text.length === 0) {
        return undefined;
      }
      try {
        return JSON.parse(text);
      } catch (cause) {
        throw new DmkNetworkClientError({
          message: "Failed to parse JSON response body",
          status: response.status,
          statusText: response.statusText,
          responseBody: text,
          cause,
        });
      }
    }
  }
}

/**
 * Reads the response body as text, swallowing any error so callers can use it
 * for best-effort diagnostics (e.g. building an error payload).
 */
export async function safeReadText(
  response: Response,
): Promise<string | undefined> {
  try {
    return await response.text();
  } catch {
    return undefined;
  }
}

/**
 * Wraps a `fetch` rejection into a typed {@link DmkNetworkClientError},
 * discriminating between external aborts, timeouts and generic failures.
 */
export function wrapFetchError(args: {
  cause: unknown;
  externalSignal: AbortSignal | undefined;
  timeoutMs: number | undefined;
}): DmkNetworkClientError {
  const { cause, externalSignal, timeoutMs } = args;
  const hasTimeout = Boolean(timeoutMs && timeoutMs > 0);
  const isAbortError =
    cause instanceof Error &&
    (cause.name === "AbortError" || cause.name === "TimeoutError");

  if (isAbortError) {
    const externallyAborted = externalSignal?.aborted ?? false;
    const timedOut =
      !externallyAborted && (cause.name === "TimeoutError" || hasTimeout);
    return new DmkNetworkClientError({
      message: timedOut ? `Request timed out` : "Request aborted",
      isTimeout: timedOut,
      isAbort: externallyAborted,
      cause,
    });
  }

  return new DmkNetworkClientError({
    message: cause instanceof Error ? cause.message : "Network request failed",
    cause,
  });
}
