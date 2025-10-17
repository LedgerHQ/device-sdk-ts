/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import type { AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";

import { AxiosButtonController } from "@internal/adapters/AxiosButtonController";
import { AxiosTouchController } from "@internal/adapters/AxiosTouchController";
import type { IButtonController } from "@internal/core/IButtonController";
import type { ITouchController } from "@internal/core/ITouchController";
import type { DeviceControllerOptions } from "@internal/core/types";
import { speculosDeviceControllerTypes as TYPES } from "@root/src/internal/core/speculosDeviceControllerTypes";

import { buildContainer } from "./di";

type K = "flex" | "stax";

const SCREENS: DeviceControllerOptions<K>["screens"] = {
  flex: { width: 128, height: 64 },
  stax: { width: 400, height: 672 },
};

function headerValue(http: AxiosInstance, name: string) {
  const headers: any = (http as any).defaults?.headers;
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get(name);
  return (
    headers[name] ??
    headers.common?.[name] ??
    headers[name.toLowerCase()] ??
    headers.common?.[name.toLowerCase()]
  );
}

describe("buildContainer", () => {
  it("configures axios with normalized baseURL, custom timeout and header", () => {
    const container = buildContainer<K>("http://example.com/api///", {
      screens: SCREENS,
      timeoutMs: 2345,
      clientHeader: "test-client",
    });

    const http = container.get<AxiosInstance>(TYPES.HttpClient);

    expect(http.defaults.baseURL).toBe("http://example.com/api");
    expect(http.defaults.timeout).toBe(2345);
    expect(headerValue(http, "X-Ledger-Client-Version")).toBe("test-client");
    expect((http.defaults as any).transitional?.clarifyTimeoutError).toBe(true);
  });

  it("applies default timeout and client header when not provided", () => {
    const container = buildContainer<K>("http://localhost:1234////", {
      screens: SCREENS,
    });

    const http = container.get<AxiosInstance>(TYPES.HttpClient);

    expect(http.defaults.baseURL).toBe("http://localhost:1234");
    expect(http.defaults.timeout).toBe(1500);
    expect(headerValue(http, "X-Ledger-Client-Version")).toBe(
      "ldmk-transport-speculos",
    );
  });

  it("binds HttpClient and Axes as constant singletons", () => {
    const container = buildContainer<K>("http://x", { screens: SCREENS });

    const http1 = container.get<AxiosInstance>(TYPES.HttpClient);
    const http2 = container.get<AxiosInstance>(TYPES.HttpClient);
    expect(http1).toBe(http2);

    const axes1 = container.get<any>(TYPES.Axes);
    const axes2 = container.get<any>(TYPES.Axes);
    expect(axes1).toBe(axes2);
    expect(axes1).toBeDefined();
    expect(typeof axes1).toBe("object");
  });

  it("binds ButtonController and TouchController to the Axios implementations as singletons", () => {
    const container = buildContainer<K>("http://x", { screens: SCREENS });

    const btn1 = container.get<IButtonController>(TYPES.ButtonController);
    const btn2 = container.get<IButtonController>(TYPES.ButtonController);
    expect(btn1).toBeInstanceOf(AxiosButtonController);
    expect(btn1).toBe(btn2);

    const touch1 = container.get<ITouchController<K>>(TYPES.TouchController);
    const touch2 = container.get<ITouchController<K>>(TYPES.TouchController);
    expect(touch1).toBeInstanceOf(AxiosTouchController);
    expect(touch1).toBe(touch2);
  });
});
