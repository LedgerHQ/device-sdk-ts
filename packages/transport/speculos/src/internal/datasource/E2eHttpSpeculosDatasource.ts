import axios, { type AxiosInstance } from "axios";

import { type E2eSpeculosDatasource } from "./E2eSpeculosDatasource";

// import 'cross-fetch/polyfill';
// import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';

type SpeculosApduDTO = { data: string };

export type SpeculosDeviceButtonsKeys =
  | "Ll"
  | "Rr"
  | "LRlr"
  | "left"
  | "right"
  | "both";

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

export class E2eHttpSpeculosDatasource implements E2eSpeculosDatasource {
  private readonly apduClient: AxiosInstance;
  private readonly buttonClient: AxiosInstance;
  private readonly sseClient: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number = 10000,
    clientHeader: string = "ldmk-transport-speculos",
  ) {
    this.apduClient = makeNoKeepAliveAxios(baseUrl, timeoutMs, clientHeader);
    this.buttonClient = makeNoKeepAliveAxios(
      baseUrl,
      Math.min(timeoutMs, 2000),
      clientHeader,
    );
    this.sseClient = makeKeepAliveAxiosForSSE(baseUrl, clientHeader);
  }

  async postApdu(apdu: string): Promise<string> {
    const { data } = await this.apduClient.post<SpeculosApduDTO>(
      "/apdu",
      { data: apdu },
      { timeout: this.timeoutMs },
    );
    return data.data;
  }

  async pressButton(but: SpeculosDeviceButtonsKeys): Promise<void> {
    const map: Record<string, "left" | "right" | "both"> = {
      Ll: "left",
      Rr: "right",
      LRlr: "both",
      left: "left",
      right: "right",
      both: "both",
    };
    const input = map[but] ?? "right";
    await this.buttonClient.post(
      `/button/${input}`,
      { action: "press-and-release" },
      { timeout: Math.min(this.timeoutMs, 1500) },
    );
  }

  /**
   * open an SSE event stream using fetch API
   * - invokes `onEvent` for each line starting with "data: "
   * - invokes `onClose` when the stream ends or errors
   * - returns the underlying ReadableStream so callers can `cancel()` it if needed
   */
  async openEventStream(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): Promise<ReadableStream<Uint8Array>> {
    if (typeof fetch === "undefined") {
      throw new Error(
        "Global fetch is not available. In Node < 18, polyfill fetch (e.g., with 'cross-fetch').",
      );
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

  get base(): string {
    return this.baseUrl;
  }
}
