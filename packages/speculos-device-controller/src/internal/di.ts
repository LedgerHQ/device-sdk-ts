import { DefaultButtonController } from "@internal/adapters/DefaultButtonController";
import { DefaultTouchController } from "@internal/adapters/DefaultTouchController";
import type { ButtonController } from "@internal/core/ButtonController";
import type { DeviceControllerOptions, HttpClient } from "@internal/core/types";
import { type AxisMap, createAxes } from "@internal/utils/axisClamp";
import type { TouchController } from "@root/src/internal/core/TouchController";

export type ControllersContainer = {
  buttons: ButtonController;
  touch: TouchController;
};

export function createDefaultControllers(
  baseURL: string,
  opts: DeviceControllerOptions,
): ControllersContainer {
  const timeoutMs = opts.timeoutMs ?? 1500;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Ledger-Client-Version":
      opts.clientHeader ?? "ldmk-transport-speculos",
  };

  const http: HttpClient = {
    async post(url: string, data?: unknown): Promise<unknown> {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(`${baseURL}${url}`, {
          method: "POST",
          headers,
          body: data !== undefined ? JSON.stringify(data) : undefined,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        return response.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };

  const axes: AxisMap = createAxes(opts.screens);

  const buttons: ButtonController = new DefaultButtonController(http);
  const touch: TouchController = new DefaultTouchController(http, axes);

  return { buttons, touch };
}
