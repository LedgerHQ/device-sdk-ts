/**
 * A request seen by {@link FetchInterceptor}.
 */
export type InterceptedRequest = {
  url: string;
  /** Upper-case HTTP method. Defaults to GET, as `fetch` does. */
  method: string;
  /**
   * The caller's init, or the method, headers, body and abort signal of a
   * `Request` input. Pass it on when re-issuing the request, so its body,
   * headers and timeout apply.
   */
  init?: RequestInit;
};

/**
 * Returns the response to serve for a request, or null to let the request
 * through to the original `fetch`.
 */
export type InterceptRequest = (
  request: InterceptedRequest,
) => Response | null | Promise<Response | null>;

const toInterceptedRequest = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<InterceptedRequest> => {
  if (input instanceof Request) {
    const method = (init?.method ?? input.method).toUpperCase();
    // Read from a clone: the original must stay readable when the request
    // goes through untouched.
    const body =
      init?.body ??
      (input.body === null ? undefined : await input.clone().arrayBuffer());
    return {
      url: input.url,
      method,
      init: {
        headers: input.headers,
        signal: input.signal,
        ...init,
        method,
        body,
      },
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
        await toInterceptedRequest(input, init),
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
