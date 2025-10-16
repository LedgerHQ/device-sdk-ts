import axios, { type AxiosInstance } from "axios";
import { Container } from "inversify";

import { AxiosButtonController } from "@internal/adapters/AxiosButtonController";
import { AxiosTouchController } from "@internal/adapters/AxiosTouchController";
import type { IButtonController } from "@internal/core/IButtonController";
import type { ITouchController } from "@internal/core/ITouchController";
import type { DeviceControllerOptions } from "@internal/core/types";
import { type AxisMap, createAxes } from "@internal/utils/axisClamp";
import { speculosDeviceControllerTypes } from "@root/src/internal/core/speculosDeviceControllerTypes";

const removeTrailingSlashes = (url: string) => url.replace(/\/+$/, "");

export function buildContainer<K extends string>(
  baseURL: string,
  opts: DeviceControllerOptions<K>,
) {
  const container = new Container({ defaultScope: "Singleton" });

  const http = axios.create({
    baseURL: removeTrailingSlashes(baseURL),
    timeout: opts.timeoutMs ?? 1500,
    headers: {
      "X-Ledger-Client-Version": opts.clientHeader ?? "ldmk-transport-speculos",
    },
    transitional: { clarifyTimeoutError: true },
  });

  container
    .bind<AxiosInstance>(speculosDeviceControllerTypes.HttpClient)
    .toConstantValue(http);
  container
    .bind<AxisMap<K>>(speculosDeviceControllerTypes.Axes)
    .toConstantValue(createAxes(opts.screens));

  container
    .bind<IButtonController>(speculosDeviceControllerTypes.ButtonController)
    .to(AxiosButtonController);
  container
    .bind<ITouchController<K>>(speculosDeviceControllerTypes.TouchController)
    .to(AxiosTouchController);

  return container;
}
