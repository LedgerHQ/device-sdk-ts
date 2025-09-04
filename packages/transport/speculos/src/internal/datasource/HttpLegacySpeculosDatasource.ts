import axios, { AxiosError, type AxiosInstance } from "axios";
import http from "http";
import https from "https";

type SpeculosApduDTO = { data: string };

const _sharedClients = new Map<string, AxiosInstance>();

function getSharedAxios(
  baseUrl: string,
  timeoutMs: number,
  clientHeader: string,
): AxiosInstance {
  const key = `${baseUrl}::${clientHeader}`;
  const existing = _sharedClients.get(key);
  if (existing) return existing;

  const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 8 });
  const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 8 });

  const inst = axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    proxy: false,
    headers: {
      "X-Ledger-Client-Version": clientHeader,
    },
    httpAgent,
    httpsAgent,
    transitional: { clarifyTimeoutError: true },
  });

  _sharedClients.set(key, inst);
  return inst;
}

export class HttpLegacySpeculosDatasource {
  private readonly client: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number = 10000,
    clientHeader: string = "ldmk-transport-speculos",
  ) {
    this.client = getSharedAxios(baseUrl, timeoutMs, clientHeader);
  }

  private async postOnce(apdu: string, ms: number): Promise<string> {
    const ac = new AbortController();
    const killer = setTimeout(() => ac.abort(), ms);
    try {
      const { data } = await this.client.post<SpeculosApduDTO>(
        "/apdu",
        { data: apdu },
        { timeout: ms, signal: ac.signal },
      );
      return data.data;
    } finally {
      clearTimeout(killer);
    }
  }

  async postAdpu(apdu: string): Promise<string> {
    const perTryMs = Math.min(1500, this.timeoutMs);
    const tries = Math.max(1, Math.floor(this.timeoutMs / perTryMs));
    let lastErr: unknown;
    for (let i = 0; i < tries; i++) {
      try {
        return await this.postOnce(apdu, perTryMs);
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 150));
      }
    }
    if (lastErr instanceof AxiosError) throw lastErr;
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
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
    await this.client.post(
      `/button/${input}`,
      { action: "press-and-release" },
      { timeout: 1500 },
    );
  }

  async openEventStream(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): Promise<NodeJS.ReadableStream> {
    const response = await this.client.get("/events", {
      params: { stream: "true" },
      responseType: "stream",
      timeout: 0, // keep SSE alive
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Accept-Encoding": "identity", // avoid gzip buffering that delays 'data' events
      },
    });
    const data = response.data as NodeJS.ReadableStream;

    const stream = data;
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

  // optional convenience getter
  get base(): string {
    return this.baseUrl;
  }
}
