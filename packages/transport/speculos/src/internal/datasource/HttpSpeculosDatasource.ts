import PACKAGE from "@root/package.json";

import { type SpeculosDatasource } from "./SpeculosDatasource";

const TIMEOUT = 2000; // 2 second timeout for availability check

const removeTrailingSlashes = (url: string) => url.replace(/\/+$/, "");

export class HttpSpeculosDatasource implements SpeculosDatasource {
  private readonly baseUrl: string;
  private readonly clientHeader: string;

  constructor(
    baseUrl: string,
    clientHeader: string = `ldmk-transport-speculos/${PACKAGE.version}`,
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
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = (await response.json()) as SpeculosApduDTO;
    return data.data;
  }

  async isServerAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
      try {
        await fetch(`${this.baseUrl}/events`, {
          headers: { "X-Ledger-Client-Version": this.clientHeader },
          signal: controller.signal,
        });
        return true;
      } finally {
        clearTimeout(timeoutId);
      }
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

          // normalise line breaks and process complete lines
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? ""; // keep last partial line

          for (const line of lines) {
            emitParsedEvent(line);
            // other SSE fields ignored to mirror original behavior
          }
        }
      } catch {
        // network/reader error
      } finally {
        // flush any remaining buffered text as lines
        if (buffer.length) {
          for (const line of buffer.split(/\r?\n/)) {
            emitParsedEvent(line);
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

