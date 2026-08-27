/**
 * src/components/DeviceScreen/sources/useSpeculosScreenApi.ts
 *
 * Reaches a Speculos instance directly, the same endpoints the mock server
 * proxies to. Uses DmkNetworkClient for consistency with the Speculos
 * transport, which already talks to this host from the browser.
 */
"use client";

import { useMemo } from "react";
import { useSelector } from "react-redux";
import { DmkNetworkClient } from "@ledgerhq/device-management-kit";

import { type ScreenApi } from "@/components/DeviceScreen/sources/screenApi";
import { selectSpeculosUrl } from "@/state/settings/selectors";

const stripTrailingSlashes = (url: string) => url.replace(/\/+$/, "");

export function useSpeculosScreenApi(): ScreenApi {
  const speculosUrl = useSelector(selectSpeculosUrl);

  return useMemo<ScreenApi>(() => {
    const base = stripTrailingSlashes(speculosUrl);
    const http = new DmkNetworkClient({ baseUrl: base });

    return {
      // Speculos is launched with an app, so there is always a screen and
      // never an idle state to describe.
      screenshot: () =>
        http.get("screenshot", { responseType: "blob" }) as Promise<Blob>,
      pressButton: async (button, action) => {
        await http.post(`button/${button}`, { action });
      },
      touch: async (x, y, action) => {
        await http.post("finger", { action, x, y });
      },
    };
  }, [speculosUrl]);
}
