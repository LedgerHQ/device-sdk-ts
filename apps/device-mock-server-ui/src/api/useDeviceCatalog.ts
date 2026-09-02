import { useEffect, useState } from "react";
import { type DeviceApp } from "@ledgerhq/device-mockserver-client";

import { api } from "@/api/client";

export type DeviceCatalog =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "loaded";
      /** Whether that OS version was ever released for this model. */
      readonly firmwareExists: boolean;
      /** The Manager API's name for the model, e.g. "Flex". */
      readonly model: string;
      readonly apps: DeviceApp[];
    };

/** Firmware is typed a character at a time; only settled input is asked about. */
const DEBOUNCE_MS = 400;

/**
 * What a model on a firmware really has: whether that OS version exists, and
 * the apps built for it. Both are asked after one debounce, because the two
 * answers are read together and an app version is only meaningful for a
 * firmware that shipped.
 */
export function useDeviceCatalog(
  token: string,
  deviceType: string,
  firmware: string,
): DeviceCatalog {
  const [state, setState] = useState<DeviceCatalog>({ status: "idle" });

  useEffect(() => {
    const version = firmware.trim();
    if (!version) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      Promise.all([
        api.checkFirmware(token, deviceType, version),
        api.listCatalogApps(token, deviceType, version),
      ])
        .then(([check, apps]) => {
          if (cancelled) return;
          setState({
            status: "loaded",
            firmwareExists: check.exists,
            model: check.model,
            apps,
          });
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          setState({
            status: "error",
            message: cause instanceof Error ? cause.message : String(cause),
          });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [token, deviceType, firmware]);

  return state;
}
