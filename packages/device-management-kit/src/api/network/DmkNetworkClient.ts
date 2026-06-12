import { DmkNetworkClientError } from "./DmkNetworkClientError";
import {
  buildBodyAndHeaders,
  buildSignal,
  buildUrl,
  type DmkQueryParams,
  type DmkResponseType,
  parseBody,
  safeReadText,
  wrapFetchError,
} from "./DmkNetworkClientHelpers";

export type { DmkQueryParamValue } from "./DmkNetworkClientHelpers";
export type { DmkQueryParams, DmkResponseType };

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
   * Per-request timeout in milliseconds. When unset (or `0`), the request
   * has no timeout.
   */
  timeoutMs?: number;
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

/**
 * Minimal axios-like wrapper over `fetch`. Handles:
 *
 * - URL composition (base URL + relative path + query params from an object)
 * - Automatic JSON body encoding and `Content-Type` header
 * - Default and per-request headers merging
 * - Request timeout via `AbortController`
 * - Automatic `response.ok` check with a typed {@link DmkNetworkClientError}
 * - Typed JSON / text / blob / arrayBuffer response parsing
 *
 * Use the high-level helpers ({@link DmkNetworkClient.get}, {@link DmkNetworkClient.post},
 * …) for 95% of calls and {@link DmkNetworkClient.request} when you need the
 * full response envelope (status, headers).
 */
export class DmkNetworkClient {
  private readonly baseUrl?: string;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl?: typeof fetch;

  constructor(options: DmkNetworkClientOptions = {}) {
    this.baseUrl = options.baseUrl;
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
    const url = buildUrl({
      url: config.url,
      params: config.params,
      baseUrl: this.baseUrl,
    });
    const { body, headers } = buildBodyAndHeaders({
      method: config.method,
      body: config.body,
      defaultHeaders: this.defaultHeaders,
      perRequestHeaders: config.headers,
    });
    const { signal, cleanup } = buildSignal({
      timeoutMs: config.timeoutMs,
    });
    const throwOnHttpError = config.throwOnHttpError ?? true;
    const responseType: DmkResponseType = config.responseType ?? "json";

    try {
      let response: Response;
      try {
        response = await this.getFetch()(url, {
          method: config.method,
          headers,
          body,
          signal,
        });
      } catch (cause) {
        throw wrapFetchError({
          cause,
          timeoutMs: config.timeoutMs,
        });
      }

      if (!response.ok && throwOnHttpError) {
        const responseBody = await safeReadText(response);
        throw new DmkNetworkClientError({
          message:
            `HTTP error ${response.status} ${response.statusText}`.trim(),
          status: response.status,
          statusText: response.statusText,
          responseBody,
        });
      }

      const data = await parseBody(response, responseType);

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        ok: response.ok,
      };
    } finally {
      cleanup();
    }
  }
}
