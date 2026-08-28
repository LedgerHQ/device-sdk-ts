/**
 * src/components/DeviceScreen/sources/useMockServerScreenApi.ts
 *
 * Reaches the device's screen through the mock server, which proxies to the
 * Speculos instance backing it. That instance only exists while an app is
 * running; once it is gone the proxy answers 409 and the device's own record
 * stands in.
 */
"use client";

import { useMemo } from "react";
import { useSelector } from "react-redux";
import { DmkNetworkClientError } from "@ledgerhq/device-management-kit";

import { type ScreenApi } from "@/components/DeviceScreen/sources/screenApi";
import { useMockClient } from "@/hooks/useMockClient";
import {
  selectMockServerSessionToken,
  selectMockServerUrl,
} from "@/state/settings/selectors";

/** The proxy answers 409 when the device has no Speculos instance. */
const isNoInstance = (error: unknown): boolean =>
  error instanceof DmkNetworkClientError && error.status === 409;

export function useMockServerScreenApi(deviceId: string): ScreenApi {
  const url = useSelector(selectMockServerUrl);
  const token = useSelector(selectMockServerSessionToken);
  const client = useMockClient(url, token);

  return useMemo<ScreenApi>(
    () => ({
      screenshot: async () => {
        try {
          return await client.getScreenshot(deviceId);
        } catch (error) {
          if (isNoInstance(error)) return null;
          throw error;
        }
      },
      idle: async () => ({
        kind: "os-info",
        device: await client.getDevice(deviceId),
      }),
      pressButton: (button, action) =>
        client.pressButton(deviceId, button, action),
      touch: (x, y, action) => client.touchScreen(deviceId, x, y, action),
    }),
    [client, deviceId],
  );
}
