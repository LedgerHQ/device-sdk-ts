import { useEffect, useState } from "react";

import { firmwareExists, listCatalogApps } from "@/api/managerApi";
import { type CatalogApp } from "@/api/managerApi";
import { findModel } from "@/domain/devices";

export type DeviceCatalog =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | {
      readonly status: "loaded";
      readonly firmwareExists: boolean;
      readonly model: string;
      readonly apps: CatalogApp[];
    };

const DEBOUNCE_MS = 400;

export function useDeviceCatalog(
  deviceType: string,
  firmware: string,
): DeviceCatalog {
  const [state, setState] = useState<DeviceCatalog>({ status: "idle" });

  useEffect(() => {
    const version = firmware.trim();
    const model = findModel(deviceType);
    if (!version) {
      setState({ status: "idle" });
      return;
    }
    if (!model) {
      setState({
        status: "error",
        message: `"${deviceType}" is not a model the Manager API knows`,
      });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    const timer = setTimeout(() => {
      Promise.all([
        firmwareExists(model.mask, version),
        listCatalogApps(model.mask, version),
      ])
        .then(([exists, apps]) => {
          if (cancelled) return;
          setState({
            status: "loaded",
            firmwareExists: exists,
            model: model.label,
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
  }, [deviceType, firmware]);

  return state;
}
