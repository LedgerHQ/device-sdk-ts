import { useEffect, useRef } from "react";

type GetJsonResponse = (url: string) => string | null;

// Allows to intercept network calls and modify their response
export function useXhrInterceptor(
  getJsonResponse: GetJsonResponse,
  enabled: boolean,
) {
  const getJsonResponseRef = useRef(getJsonResponse);
  const originalOpenRef = useRef<typeof XMLHttpRequest.prototype.open | null>(
    null,
  );
  const originalSendRef = useRef<typeof XMLHttpRequest.prototype.send | null>(
    null,
  );

  const restoreOriginalMethods = () => {
    if (originalOpenRef.current && originalSendRef.current) {
      XMLHttpRequest.prototype.open = originalOpenRef.current;
      XMLHttpRequest.prototype.send = originalSendRef.current;
      originalOpenRef.current = null;
      originalSendRef.current = null;
    }
  };

  useEffect(() => {
    getJsonResponseRef.current = getJsonResponse;
  }, [getJsonResponse]);

  useEffect(() => {
    // When disabled, restore to original XHR instance
    if (!enabled) {
      restoreOriginalMethods();
      return;
    }

    // Backup XHR open and send functions
    originalOpenRef.current = XMLHttpRequest.prototype.open;
    originalSendRef.current = XMLHttpRequest.prototype.send;

    // Modify them for interception
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest & { _url?: string },
      method: string,
      url: string | URL,
      async: boolean = true,
      user?: string | null,
      password?: string | null,
    ) {
      this._url = typeof url === "string" ? url : url.toString();
      return originalOpenRef.current!.apply(this, [
        method,
        url,
        async,
        user,
        password,
      ]);
    };

    XMLHttpRequest.prototype.send = function (
      this: XMLHttpRequest & { _url?: string },
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      if (this._url) {
        // Try to get modified response (returns null if not intercepted)
        const response = getJsonResponseRef.current(this._url);
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
      return originalSendRef.current!.apply(this, [body]);
    };

    return () => {
      restoreOriginalMethods();
    };
  }, [enabled]);
}
