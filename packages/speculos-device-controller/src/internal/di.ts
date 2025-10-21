import axios, { type AxiosInstance } from "axios";

import { DefaultButtonController } from "@internal/adapters/DefaultButtonController";
import { DefaultTouchController } from "@internal/adapters/DefaultTouchController";
import type { ButtonController } from "@internal/core/ButtonController";
import type { DeviceControllerOptions } from "@internal/core/types";
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
  const http: AxiosInstance = axios.create({
    baseURL: baseURL,
    timeout: opts.timeoutMs ?? 1500,
    headers: {
      "X-Ledger-Client-Version": opts.clientHeader ?? "ldmk-transport-speculos",
    },
    transitional: { clarifyTimeoutError: true },
  });

  const axes: AxisMap = createAxes(opts.screens);

  const buttons: ButtonController = new DefaultButtonController(http);
  const touch: TouchController = new DefaultTouchController(http, axes);

  return { buttons, touch };
}
