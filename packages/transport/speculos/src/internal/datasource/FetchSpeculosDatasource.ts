import { type SpeculosDatasource } from "./SpeculosDatasource";

const DEFAULT_CLIENT_HEADER = "ldmk-transport-speculos";
const AVAILABILITY_TIMEOUT_MS = 2000;
const POLL_INTERVAL_MS = 500;

const removeTrailingSlashes = (url: string) => url.replace(/\/+$/, "");

/**
 * SpeculosDatasource implementation using native `fetch()`.
 *
 * Works in all JS runtimes: Node.js 18+, browsers, React Native.
 * Replaces the axios-based HttpSpeculosDatasource for environments
 * where axios's Node.js HTTP adapter is unavailable (e.g. React Native).
 */
export class FetchSpeculosDatasource implements SpeculosDatasource {
  private readonly baseUrl: string;
  private readonly clientHeader: string;

  constructor(
    baseUrl: string,
    clientHeader: string = DEFAULT_CLIENT_HEADER,
  ) {
    this.baseUrl = removeTrailingSlashes(baseUrl);
    this.clientHeader = clientHeader;
  }

  async postApdu(apdu: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/apdu`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ledger-Client-Version": this.clientHeader,
      },
      body: JSON.stringify({ data: apdu }),
    });
    if (!response.ok) {
      throw new Error(
        `Speculos APDU POST failed: HTTP ${response.status} ${response.statusText}`,
      );
    }
    const json = (await response.json()) as SpeculosApduDTO;
    return json.data;
  }

  async isServerAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        AVAILABILITY_TIMEOUT_MS,
      );
      const response = await fetch(`${this.baseUrl}/events`, {
        method: "GET",
        headers: { "X-Ledger-Client-Version": this.clientHeader },
        signal: controller.signal,
      });
      clearTimeout(timer);
      return response.ok;
    } catch {
      return false;
    }
  }

  async openEventStream(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): Promise<ReadableStream<Uint8Array> | { cancel: () => void }> {
    if (typeof ReadableStream === "undefined") {
      return this._openEventStreamPolling(onEvent, onClose);
    }
    return this._openEventStreamSSE(onEvent, onClose);
  }

  private _openEventStreamPolling(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): { cancel: () => void } {
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const response = await fetch(`${this.baseUrl}/events`, {
            method: "GET",
            headers: { "X-Ledger-Client-Version": this.clientHeader },
          });
          if (response.ok) {
            const data = (await response.json()) as SpeculosEventsDTO;
            if (data?.events) {
              for (const event of data.events) {
                onEvent(event as Record<string, unknown>);
              }
            }
          }
        } catch {
          // ignore polling errors
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
      try {
        onClose?.();
      } catch {
        // swallow listener errors
      }
    };
    poll();

    return {
      cancel: () => {
        cancelled = true;
      },
    };
  }

  private async _openEventStreamSSE(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): Promise<ReadableStream<Uint8Array>> {
    const url = `${this.baseUrl}/events?stream=true`;
    const controller = new AbortController();

    const headers: HeadersInit = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Ledger-Client-Version": this.clientHeader,
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

    const emitParsedEvent = (line: string) => {
      if (line.startsWith("data: ")) {
        const payload = line.slice(6);
        try {
          onEvent(JSON.parse(payload));
        } catch {
          onEvent({ data: payload });
        }
      }
    };

    (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            emitParsedEvent(line);
          }
        }
      } catch {
        // network/reader error
      } finally {
        if (buffer.length) {
          for (const line of buffer.split(/\r?\n/)) {
            emitParsedEvent(line);
          }
          buffer = "";
        }
        finalize();
      }
    })();

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
