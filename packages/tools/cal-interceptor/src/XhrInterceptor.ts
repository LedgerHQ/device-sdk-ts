/**
 * XHR Interceptor - allows intercepting XMLHttpRequest calls
 * and modifying their responses
 */

type GetJsonResponse = (url: string) => string | null;

export class XhrInterceptor {
  private getJsonResponse: GetJsonResponse;
  private isActive = false;
  private originalOpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalSend: typeof XMLHttpRequest.prototype.send | null = null;

  constructor(getJsonResponse: GetJsonResponse) {
    this.getJsonResponse = getJsonResponse;
  }

  /**
   * Update the response handler function
   */
  setResponseHandler(getJsonResponse: GetJsonResponse): void {
    this.getJsonResponse = getJsonResponse;
  }

  /**
   * Start intercepting XHR requests
   */
  start(): void {
    if (this.isActive) {
      console.warn("XHR Interceptor is already active");
      return;
    }

    // Backup original XHR methods
    this.originalOpen = XMLHttpRequest.prototype.open;
    this.originalSend = XMLHttpRequest.prototype.send;

    const originalOpen = this.originalOpen;
    const originalSend = this.originalSend;
    const getJsonResponse = this.getJsonResponse;

    // Override open method to capture URL
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { _url?: string },
      method: string,
      url: string | URL,
      async: boolean = true,
      user?: string | null,
      password?: string | null,
    ) {
      this._url = typeof url === "string" ? url : url.toString();
      return originalOpen.apply(this, [method, url, async, user, password]);
    };

    // Override send method to intercept response
    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { _url?: string },
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      if (this._url) {
        // Try to get modified response (returns null if not intercepted)
        const response = getJsonResponse(this._url);
        if (response) {
          // Simulate async response
          setTimeout(() => {
            Object.defineProperty(this, "responseText", {
              get: () => response,
            });
            Object.defineProperty(this, "response", { get: () => response });
            Object.defineProperty(this, "responseType", { get: () => "json" });
            Object.defineProperty(this, "status", { get: () => 200 });
            Object.defineProperty(this, "statusText", { get: () => "OK" });
            Object.defineProperty(this, "readyState", {
              get: () => 4 /*DONE*/,
            });

            // Trigger events
            if (this.onreadystatechange) {
              this.onreadystatechange(new Event("readystatechange"));
            }
            if (this.onload) {
              this.onload(new ProgressEvent("load"));
            }
            if (this.onloadend) {
              this.onloadend(new ProgressEvent("loadend"));
            }
          }, 0);
          return;
        }
      }
      return originalSend.apply(this, [body]);
    };

    this.isActive = true;
  }

  /**
   * Stop intercepting XHR requests
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    if (this.originalOpen && this.originalSend) {
      XMLHttpRequest.prototype.open = this.originalOpen;
      XMLHttpRequest.prototype.send = this.originalSend;
      this.originalOpen = null;
      this.originalSend = null;
    }

    this.isActive = false;
  }

  /**
   * Check if interceptor is currently active
   */
  isIntercepting(): boolean {
    return this.isActive;
  }
}
