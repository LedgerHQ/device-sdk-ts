import { type AxiosInstance } from "axios";

import {
  makeKeepAliveAxiosForSSE,
  makeNoKeepAliveAxios,
} from "@internal/utils/axiosInstances";

import { type E2eSpeculosDatasource } from "./E2eSpeculosDatasource";

type SpeculosApduDTO = { data: string };

export type SpeculosDeviceButtonsKeys =
  | "Ll"
  | "Rr"
  | "LRlr"
  | "left"
  | "right"
  | "both";

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

  async postAdpu(apdu: string): Promise<string> {
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

  async openEventStream(
    onEvent: (json: Record<string, unknown>) => void,
    onClose?: () => void,
  ): Promise<NodeJS.ReadableStream> {
    const response = await this.sseClient.get("/events", {
      params: { stream: "true" },
      responseType: "stream",
      timeout: 0,
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
