import axios, { type AxiosInstance } from "axios";

export type DeviceInteractorOptions = {
  timeoutMs?: number;
  clientHeader?: string;
};

export type SpeculosDeviceButtonsKeys =
  | "Ll"
  | "Rr"
  | "LRlr"
  | "left"
  | "right"
  | "both";

export class DeviceInteractor {
  private readonly buttonClient: AxiosInstance;

  constructor(
    private readonly baseURL: string,
    opts: DeviceInteractorOptions = {},
  ) {
    const timeoutMs = opts.timeoutMs ?? 1500;
    const clientHeader = opts.clientHeader ?? "ldmk-transport-speculos";

    this.buttonClient = axios.create({
      baseURL: this.baseURL.replace(/\/+$/, ""),
      timeout: timeoutMs,
      headers: {
        "X-Ledger-Client-Version": clientHeader,
      },
      transitional: { clarifyTimeoutError: true },
    });
  }

  private toEndpointKey(
    but: SpeculosDeviceButtonsKeys,
  ): "left" | "right" | "both" {
    const map: Record<string, "left" | "right" | "both"> = {
      Ll: "left",
      Rr: "right",
      LRlr: "both",
      left: "left",
      right: "right",
      both: "both",
    };
    return map[but] ?? "right";
  }

  async press(but: SpeculosDeviceButtonsKeys): Promise<void> {
    const input = this.toEndpointKey(but);
    await this.buttonClient.post(`/button/${input}`, {
      action: "press-and-release",
    });
  }

  left() {
    return this.press("left");
  }
  right() {
    return this.press("right");
  }
  both() {
    return this.press("both");
  }

  async pressSequence(
    keys: SpeculosDeviceButtonsKeys[],
    delayMs = 200,
  ): Promise<void> {
    for (const k of keys) {
      await this.press(k);
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
}
