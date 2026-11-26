/**
 * A request seen by {@link FetchInterceptor}.
 */
export type InterceptedRequest = {
  url: string;
  /** Upper-case HTTP method. Defaults to GET, as `fetch` does. */
  method: string;
  /**
   * The caller's init, or the method, headers and abort signal of a `Request`
   * input. Pass it on when re-issuing the request, so its body, headers and
   * timeout apply.
   */
  init?: RequestInit;
  /**
   * Reads the body of a `Request` input, which `init` leaves out. Call it only
   * to re-issue the request: it waits for the whole upload. It reads a clone,
   * so the original can still go through untouched.
   */
  readBody?: () => Promise<ArrayBuffer>;
};

/**
 * Returns the response to serve for a request, or null to let the request
 * through to the original `fetch`.
 */
export type InterceptRequest = (
  request: InterceptedRequest,
) => Response | null | Promise<Response | null>;

const toInterceptedRequest = (
  input: RequestInfo | URL,
  init?: RequestInit,
): InterceptedRequest => {
  if (input instanceof Request) {
    const method = (init?.method ?? input.method).toUpperCase();
    return {
      url: input.url,
      method,
      init: {
        headers: input.headers,
        signal: input.signal,
        ...init,
        method,
      },
      // Lazy: a request let through must keep streaming its body as it comes.
      ...(init?.body === undefined && input.body !== null
        ? { readBody: () => input.clone().arrayBuffer() }
        : {}),
    };
  }
  return {
    url: input instanceof URL ? input.toString() : input,
    method: (init?.method ?? "GET").toUpperCase(),
    init,
  };
};

export class FetchInterceptor {
  private interceptRequest: InterceptRequest;
  private isActive = false;
  private originalFetch: typeof fetch | null = null;

  constructor(interceptRequest: InterceptRequest) {
    this.interceptRequest = interceptRequest;
  }

  start(): void {
    if (this.isActive) {
      console.warn("Fetch Interceptor is already active");
      return;
    }

    const originalFetch = globalThis.fetch;
    this.originalFetch = originalFetch;
    globalThis.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const response = await this.interceptRequest(
        toInterceptedRequest(input, init),
      );
      return response ?? originalFetch(input, init);
    };

    this.isActive = true;
  }

  stop(): void {
    if (!this.isActive) {
      return;
    }

    if (this.originalFetch) {
      globalThis.fetch = this.originalFetch;
      this.originalFetch = null;
    }

    this.isActive = false;
  }

  isIntercepting(): boolean {
    return this.isActive;
  }
}
