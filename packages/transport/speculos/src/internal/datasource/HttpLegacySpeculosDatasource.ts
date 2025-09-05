import axios, { type AxiosInstance } from "axios";
import http from "http";
import https from "https";

type SpeculosApduDTO = { data: string };

function makeNoKeepAliveAxios(
  baseUrl: string,
  timeoutMs: number,
  clientHeader: string,
): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/+$/, ""),
    timeout: timeoutMs,
    proxy: false,
    headers: {
      "X-Ledger-Client-Version": clientHeader,
      Connection: "close",
    },
    httpAgent: new http.Agent({ keepAlive: false, maxSockets: Infinity }),
    httpsAgent: new https.Agent({ keepAlive: false, maxSockets: Infinity }),
    transitional: { clarifyTimeoutError: true },
  });
}

function makeKeepAliveAxiosForSSE(
  baseUrl: string,
  clientHeader: string,
): AxiosInstance {
  return axios.create({
    baseURL: baseUrl.replace(/\/+$/, ""),
    timeout: 0, // long-lived
    proxy: false,
    headers: {
      "X-Ledger-Client-Version": clientHeader,

      Connection: "keep-alive",
    },
    httpAgent: new http.Agent({
      keepAlive: true,
      maxSockets: 1,
      maxFreeSockets: 1,
    }),
    httpsAgent: new https.Agent({
      keepAlive: true,
      maxSockets: 1,
      maxFreeSockets: 1,
    }),
    transitional: { clarifyTimeoutError: true },
  });
}

export class HttpLegacySpeculosDatasource {
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

  async postAdpu(apdu: string): Promise<string> {
    const { data } = await this.apduClient.post<SpeculosApduDTO>(
      "/apdu",
      { data: apdu },
      { timeout: this.timeoutMs },
    );
    return data.data;
  }

  async pressButton(
    but: "Ll" | "Rr" | "LRlr" | "left" | "right" | "both",
  ): Promise<void> {
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

  async openEventStream(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): Promise<NodeJS.ReadableStream> {
    const response = await this.sseClient.get("/events", {
      params: { stream: "true" },
      responseType: "stream",
      timeout: 0, // keep SSE alive
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Accept-Encoding": "identity",
      },
    });

    const stream = response.data as NodeJS.ReadableStream;

    stream.on("data", (chunk: Buffer) => {
      const txt = chunk.toString("utf8");
      txt.split("\n").forEach((line) => {
        if (line.startsWith("data: ")) {
          const payload = line.slice(6);
          try {
            onEvent(JSON.parse(payload));
          } catch {
            onEvent({ data: payload });
          }
        }
      });
    });

    const end = () => onClose?.();
    stream.on("close", end);
    stream.on("end", end);
    stream.on("error", end);

    return stream;
  }

  get base(): string {
    return this.baseUrl;
  }
}
