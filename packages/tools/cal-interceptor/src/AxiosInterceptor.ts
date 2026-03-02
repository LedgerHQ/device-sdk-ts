type GetJsonResponse = (url: string) => string | null;

export class FetchInterceptor {
  private getJsonResponse: GetJsonResponse;
  private isActive = false;
  private originalFetch: typeof fetch | null = null;

  constructor(getJsonResponse: GetJsonResponse) {
    this.getJsonResponse = getJsonResponse;
  }

  start(): void {
    if (this.isActive) {
      console.warn("Fetch Interceptor is already active");
      return;
    }

    this.originalFetch = globalThis.fetch;
    globalThis.fetch = async (
      input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> => {
      const url =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.toString()
            : input;

      const jsonResponse = this.getJsonResponse(url);
      if (jsonResponse) {
        return new Response(jsonResponse, {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json" },
        });
      }

      return this.originalFetch!(input, init);
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
