import { DmkNetworkClientError } from "./DmkNetworkClientError";

/**
 * Values accepted for URL query parameters. `null`/`undefined` entries are
 * skipped so callers can build params objects conditionally without guards.
 */
export type DmkQueryParamValue = string | number | boolean | null | undefined;

export type DmkQueryParams = Record<string, DmkQueryParamValue>;

export type DmkResponseType = "json" | "text" | "blob" | "arrayBuffer" | "void";

/**
 * Per-request configuration. Everything is optional — sensible defaults are
 * applied by the client.
 */
export type DmkRequestConfig = {
  /** Query params merged into the URL. `null`/`undefined` entries are skipped. */
  params?: DmkQueryParams;
  /** Per-request headers merged on top of the client's default headers. */
  headers?: Record<string, string>;
  /**
   * Per-request timeout in milliseconds. Overrides the client default.
   * Pass `0` to disable the timeout entirely for this request.
   */
  timeoutMs?: number;
  /**
   * External abort signal. Composed with the internal timeout signal, so
   * either one firing will abort the request.
   */
  signal?: AbortSignal;
  /**
   * How to parse the response body. Defaults to `"json"`, except for `head`
   * which always resolves to `void`.
   */
  responseType?: DmkResponseType;
  /**
   * When `true` (default), non-2xx responses throw {@link DmkNetworkClientError}.
   * Set to `false` to resolve normally and inspect {@link DmkNetworkResponse}
   * via {@link DmkNetworkClient.request}.
   */
  throwOnHttpError?: boolean;
};

/**
 * Full response envelope returned by {@link DmkNetworkClient.request}.
 * The simple method helpers (`get`, `post`, …) unwrap to `data` directly.
 *
 * `data` is intentionally typed as `unknown`: network payloads are untrusted
 * input, so callers must narrow it with a type guard or runtime validator
 * (e.g. the existing DTO mappers) before use.
 */
export type DmkNetworkResponse = {
  data: unknown;
  status: number;
  statusText: string;
  headers: Headers;
  ok: boolean;
};

export type DmkNetworkClientOptions = {
  /** Base URL prepended to relative request URLs. */
  baseUrl?: string;
  /** Default timeout applied to every request (ms). `0` disables. */
  timeoutMs?: number;
  /** Default headers merged into every request. */
  headers?: Record<string, string>;
  /** Injection point for tests. Defaults to `globalThis.fetch`. */
  fetch?: typeof fetch;
};

type InternalRequestConfig = DmkRequestConfig & {
  method: string;
  url: string;
  body?: unknown;
};

const JSON_CONTENT_TYPE = "application/json";

/**
 * Minimal axios-like wrapper over `fetch`. Handles:
 *
 * - URL composition (base URL + relative path + query params from an object)
 * - Automatic JSON body encoding and `Content-Type` header
 * - Default and per-request headers merging
 * - Request timeout via `AbortSignal.timeout`, composable with a caller signal
 * - Automatic `response.ok` check with a typed {@link DmkNetworkClientError}
 * - Typed JSON / text / blob / arrayBuffer response parsing
 *
 * Use the high-level helpers ({@link DmkNetworkClient.get}, {@link DmkNetworkClient.post},
 * …) for 95% of calls and {@link DmkNetworkClient.request} when you need the
 * full response envelope (status, headers).
 */
export class DmkNetworkClient {
  private readonly baseUrl?: string;
  private readonly defaultTimeoutMs?: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: DmkNetworkClientOptions = {}) {
    this.baseUrl = options.baseUrl;
    this.defaultTimeoutMs = options.timeoutMs;
    this.defaultHeaders = options.headers ?? {};
    this.fetchImpl = options.fetch;
  }

  private getFetch(): typeof fetch {
    // Resolve `fetch` at call time so that spies installed on `globalThis.fetch`
    // after the client was constructed are still honored.
    return this.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  public get(url: string, config?: DmkRequestConfig): Promise<unknown> {
    return this.request({ ...config, method: "GET", url }).then(
      (res) => res.data,
    );
  }

  public post(
    url: string,
    body?: unknown,
    config?: DmkRequestConfig,
  ): Promise<unknown> {
    return this.request({ ...config, method: "POST", url, body }).then(
      (res) => res.data,
    );
  }

  public put(
    url: string,
    body?: unknown,
    config?: DmkRequestConfig,
  ): Promise<unknown> {
    return this.request({ ...config, method: "PUT", url, body }).then(
      (res) => res.data,
    );
  }

  public patch(
    url: string,
    body?: unknown,
    config?: DmkRequestConfig,
  ): Promise<unknown> {
    return this.request({ ...config, method: "PATCH", url, body }).then(
      (res) => res.data,
    );
  }

  public delete(url: string, config?: DmkRequestConfig): Promise<unknown> {
    return this.request({ ...config, method: "DELETE", url }).then(
      (res) => res.data,
    );
  }

  public head(url: string, config?: DmkRequestConfig): Promise<void> {
    return this.request({
      ...config,
      method: "HEAD",
      url,
      responseType: "void",
    }).then(() => undefined);
  }

  /**
   * Escape hatch returning the full response envelope (status, headers, data).
   * Most callers should prefer {@link get}, {@link post}, etc.
   *
   * `data` is `unknown` by design; validate it with a type guard before use.
   */
  public async request(
    config: InternalRequestConfig,
  ): Promise<DmkNetworkResponse> {
    const url = this.buildUrl(config.url, config.params);
    const { body, headers } = this.buildBodyAndHeaders(
      config.method,
      config.body,
      config.headers,
    );
    const signal = this.buildSignal(config.timeoutMs, config.signal);
    const throwOnHttpError = config.throwOnHttpError ?? true;
    const responseType: DmkResponseType = config.responseType ?? "json";

    let response: Response;
    try {
      response = await this.getFetch()(url, {
        method: config.method,
        headers,
        body,
        signal,
      });
    } catch (cause) {
      throw this.wrapFetchError(cause, config.signal, config.timeoutMs);
    }

    if (!response.ok && throwOnHttpError) {
      const responseBody = await this.safeReadText(response);
      throw new DmkNetworkClientError({
        message: `HTTP error ${response.status} ${response.statusText}`.trim(),
        status: response.status,
        statusText: response.statusText,
        responseBody,
      });
    }

    const data = await this.parseBody(response, responseType);

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      ok: response.ok,
    };
  }

  private buildUrl(url: string, params?: DmkQueryParams): URL {
    const fullUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(url)
      ? new URL(url)
      : this.baseUrl
        ? new URL(this.joinPath(this.baseUrl, url))
        : new URL(url);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== null && value !== undefined) {
          fullUrl.searchParams.set(key, String(value));
        }
      }
    }

    return fullUrl;
  }

  private joinPath(base: string, path: string): string {
    if (!path) return base;
    const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
    const trimmedPath = path.startsWith("/") ? path : `/${path}`;
    return `${trimmedBase}${trimmedPath}`;
  }

  private buildBodyAndHeaders(
    method: string,
    body: unknown,
    perRequestHeaders?: Record<string, string>,
  ): { body?: BodyInit; headers: Record<string, string> } {
    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...perRequestHeaders,
    };

    if (body === undefined || method === "GET" || method === "HEAD") {
      return { body: undefined, headers };
    }

    if (this.isRawBody(body)) {
      return { body, headers };
    }

    if (!this.hasHeader(headers, "content-type")) {
      headers["Content-Type"] = JSON_CONTENT_TYPE;
    }
    return { body: JSON.stringify(body), headers };
  }

  private isRawBody(body: unknown): body is BodyInit {
    return (
      typeof body === "string" ||
      body instanceof ArrayBuffer ||
      body instanceof Blob ||
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      body instanceof ReadableStream ||
      ArrayBuffer.isView(body)
    );
  }

  private hasHeader(headers: Record<string, string>, name: string): boolean {
    const lower = name.toLowerCase();
    return Object.keys(headers).some((k) => k.toLowerCase() === lower);
  }

  private buildSignal(
    perRequestTimeoutMs: number | undefined,
    externalSignal: AbortSignal | undefined,
  ): AbortSignal | undefined {
    const timeoutMs = perRequestTimeoutMs ?? this.defaultTimeoutMs;
    const timeoutSignal =
      timeoutMs && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined;

    if (timeoutSignal && externalSignal) {
      return AbortSignal.any([externalSignal, timeoutSignal]);
    }
    return timeoutSignal ?? externalSignal;
  }

  private async parseBody(
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

  private async safeReadText(response: Response): Promise<string | undefined> {
    try {
      return await response.text();
    } catch {
      return undefined;
    }
  }

  private wrapFetchError(
    cause: unknown,
    externalSignal: AbortSignal | undefined,
    perRequestTimeoutMs: number | undefined,
  ): DmkNetworkClientError {
    const timeoutMs = perRequestTimeoutMs ?? this.defaultTimeoutMs;
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
      message:
        cause instanceof Error ? cause.message : "Network request failed",
      cause,
    });
  }
}
