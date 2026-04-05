import {
  type DeviceControllerClient,
  deviceControllerClientFactory,
  type TapFactory,
} from "@ledgerhq/speculos-device-controller";
import axios, { type AxiosInstance } from "axios";

import type { ScreenEvent } from "./screen-events";

function createHttpClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: 5000,
    headers: { "X-Ledger-Client-Version": "speculos-mcp" },
    transitional: { clarifyTimeoutError: true },
  });
}

export type SpeculosClient = {
  checkConnection: () => Promise<void>;
  fetchEvents: () => Promise<ScreenEvent[]>;
  fetchScreenshot: () => Promise<string>;
  tap: (x: number, y: number, options?: { delay?: number }) => Promise<void>;

  setDevice: (device: string) => void;
  navigate: (direction: "next" | "previous") => Promise<void>;
  sign: (delayMs?: number) => Promise<void>;
  reject: () => Promise<void>;
  confirm: () => Promise<void>;
  dismissSecondary: () => Promise<void>;
};

type TapInstance = ReturnType<TapFactory>;

function requireTap(tap: TapInstance | null): TapInstance {
  if (!tap) {
    throw new Error(
      "Device not configured. Call setDevice() before using device actions.",
    );
  }
  return tap;
}

export function createSpeculosClient(
  baseURL: string = process.env["SPECULOS_API_URL"] ?? "http://localhost:5000",
): SpeculosClient {
  const http = createHttpClient(baseURL);
  const controller: DeviceControllerClient = deviceControllerClientFactory(
    baseURL,
    { clientHeader: "speculos-mcp" },
  );
  let tap: TapInstance | null = null;

  return {
    setDevice(device: string): void {
      tap = controller.tapFactory(device);
    },

    async checkConnection(): Promise<void> {
      try {
        await http.get("/events", {
          params: { currentscreenonly: true },
          headers: { Accept: "application/json" },
        });
      } catch {
        throw new Error(
          `Cannot reach Speculos at ${baseURL}. Is the emulator running?`,
        );
      }
    },

    async fetchEvents(): Promise<ScreenEvent[]> {
      const response = await http.get<{ events: ScreenEvent[] }>("/events", {
        params: { currentscreenonly: true },
        headers: { Accept: "application/json" },
      });
      return response.data.events;
    },

    async fetchScreenshot(): Promise<string> {
      const response = await http.get<ArrayBuffer>("/screenshot", {
        responseType: "arraybuffer",
      });
      return Buffer.from(response.data).toString("base64");
    },

    async tap(
      x: number,
      y: number,
      options?: { delay?: number },
    ): Promise<void> {
      await http.post("/finger", {
        action: "press-and-release",
        x,
        y,
        ...(options?.delay != null && { delay: options.delay }),
      });
    },

    async navigate(direction: "next" | "previous"): Promise<void> {
      const t = requireTap(tap);
      if (direction === "next") {
        await t.navigateNext();
      } else {
        await t.navigatePrevious();
      }
    },

    async sign(delayMs?: number): Promise<void> {
      await requireTap(tap).sign(delayMs);
    },

    async reject(): Promise<void> {
      await requireTap(tap).reject();
    },

    async confirm(): Promise<void> {
      await requireTap(tap).mainButton();
    },

    async dismissSecondary(): Promise<void> {
      await requireTap(tap).secondaryButton();
    },
  };
}
