import axios, { type AxiosInstance } from "axios";

import { AxiosButtonController } from "@internal/adapters/AxiosButtonController";
import { AxiosTouchController } from "@internal/adapters/AxiosTouchController";
import type { IButtonController } from "@internal/core/IButtonController";
import type { ITouchController } from "@internal/core/ITouchController";
import type { DeviceControllerOptions } from "@internal/core/types";
import { type AxisMap, createAxes } from "@internal/utils/axisClamp";

const removeTrailingSlashes = (url: string) => url.replace(/\/+$/, "");

export type ControllersContainer = {
  buttons: IButtonController;
  touch: ITouchController;
};

export function createDefaultControllers(
  baseURL: string,
  opts: DeviceControllerOptions,
): ControllersContainer {
  const http: AxiosInstance = axios.create({
    baseURL: removeTrailingSlashes(baseURL),
    timeout: opts.timeoutMs ?? 1500,
    headers: {
      "X-Ledger-Client-Version": opts.clientHeader ?? "ldmk-transport-speculos",
    },
    transitional: { clarifyTimeoutError: true },
  });

  const axes: AxisMap = createAxes(opts.screens);

  const buttons: IButtonController = new AxiosButtonController(http);
  const touch: ITouchController = new AxiosTouchController(http, axes);

  return { buttons, touch };
}
