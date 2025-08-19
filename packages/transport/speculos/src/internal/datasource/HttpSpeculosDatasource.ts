import axios, { type AxiosInstance } from "axios";

import PACKAGE from "@root/package.json";

import { type SpeculosDatasource } from "./SpeculosDatasource";

const TIMEOUT = 10000; // 10 second timeout for availability check

export function makeNoKeepAliveAxios(
  baseUrl: string,
  timeoutMs: number,
  clientHeader: string,
): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/+$/, ""),
    timeout: timeoutMs,
    headers: {
      "X-Ledger-Client-Version": clientHeader,
    },
    transitional: { clarifyTimeoutError: true },
  });
}

export function makeKeepAliveAxiosForSSE(
  baseUrl: string,
  clientHeader: string,
): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/+$/, ""),
    timeout: 0, // no timeout for SSE
    headers: {
      "X-Ledger-Client-Version": clientHeader,
    },
    transitional: { clarifyTimeoutError: true },
  });
}

export class HttpSpeculosDatasource implements SpeculosDatasource {
  private readonly apduClient: AxiosInstance;
  private readonly sseClient: AxiosInstance | null = null;

  constructor(
    private readonly baseUrl: string,
    private readonly _isE2E: boolean = false,
    clientHeader: string = `ldmk-transport-speculos/${PACKAGE.version}`,
  ) {
    this.apduClient = makeNoKeepAliveAxios(baseUrl, TIMEOUT, clientHeader);
    if (this._isE2E) {
      this.sseClient = makeKeepAliveAxiosForSSE(baseUrl, clientHeader);
    }
  }

  async postApdu(apdu: string): Promise<string> {
    const { data } = await this.apduClient.post<SpeculosApduDTO>(
      "/apdu",
      { data: apdu },
      { timeout: TIMEOUT },
    );
    return data.data;
  }

  async isServerAvailable(): Promise<boolean> {
    try {
      await this.apduClient.request<SpeculosEventsDTO>({
        method: "GET",
        url: "/events",
        timeout: TIMEOUT,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * open an SSE event stream using the fetch API.
   * - calls `onEvent` for each line starting with "data: "
   * - calls `onClose` when the stream ends or errors
   * - returns the ReadableStream so callers can `cancel()` it
   */
  async openEventStream(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): Promise<ReadableStream<Uint8Array>> {
    if (typeof fetch === "undefined") {
      throw new Error("global fetch is not available in Node < 18");
    }
    if (!this.sseClient) {
      throw new Error("SSE not supported unless in E2E mode");
    }

    const urlBase = this.sseClient.defaults.baseURL ?? this.baseUrl;
    const url = `${urlBase!.replace(/\/+$/, "")}/events?stream=true`;

    const controller = new AbortController();

    const headers: HeadersInit = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Ledger-Client-Version":
        (this.sseClient.defaults.headers?.common?.[
          "X-Ledger-Client-Version"
        ] as string) ?? "ldmk-transport-speculos",
    };

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      controller.abort();
      throw new Error(`SSE request failed with status ${response.status}`);
    }

    const stream = response.body;
    if (!stream) {
      controller.abort();
      throw new Error("SSE response has no body stream.");
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let closed = false;

    const finalize = () => {
      if (!closed) {
        closed = true;
        try {
          onClose?.();
        } catch {
          // swallow listener errors
        }
      }
    };

    (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // normalise line breaks and process complete lines
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? ""; // keep last partial line

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6);
              try {
                onEvent(JSON.parse(payload));
              } catch {
                onEvent({ data: payload });
              }
            }
            // other SSE fields ignored to mirror original behavior
          }
        }
      } catch {
        // network/reader error
      } finally {
        // flush any remaining buffered text as lines
        if (buffer.length) {
          for (const line of buffer.split(/\r?\n/)) {
            if (line.startsWith("data: ")) {
              const payload = line.slice(6);
              try {
                onEvent(JSON.parse(payload));
              } catch {
                onEvent({ data: payload });
              }
            }
          }
          buffer = "";
        }
        finalize();
      }
    })();

    // consumers can cancel with: (await openEventStream(...)).cancel()
    return stream;
  }
}

type SpeculosApduDTO = {
  data: string;
};

type SpeculosEventsDTO = {
  events: Array<{
    text?: string;
    x?: number;
    y?: number;
  }>;
};
