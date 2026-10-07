import { useEffect, useState } from "react";

import { api } from "@/api/client";
import { findModel } from "@/domain/devices";

export type DeviceCatalog =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | {
      readonly status: "loaded";
      /**
       * Versions Speculos can boot per app on this firmware, keyed by the
       * catalogue's app name — empty when it has no build of the firmware —
       * or `null` without a catalogue: the model has no emulator, the server
       * has no operator, or Speculinho is down.
       */
      readonly speculosApps: Record<string, string[]> | null;
    };

const DEBOUNCE_MS = 400;

/** Fetched once per model and firmware, and kept for the page's lifetime. */
const cache = new Map<string, Record<string, string[]>>();

export function useDeviceCatalog(
  deviceType: string,
  firmware: string,
): DeviceCatalog {
  const version = firmware.trim();
  const hasEmulator = findModel(deviceType)?.speculos === true;
  const key = `${deviceType}:${version}`;
  // Kept with the query it answers, so a model or firmware change never shows
  // the last firmware's apps for a render.
  const [result, setResult] = useState<{
    readonly key: string;
    readonly speculosApps: Record<string, string[]> | null;
  } | null>(null);

  useEffect(() => {
    if (!version || !hasEmulator || cache.has(key)) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void api
        .speculosAppVersions(deviceType, version)
        .then(({ apps }) => {
          cache.set(key, apps);
          return apps;
        })
        .catch(() => null)
        .then((speculosApps) => {
          if (!cancelled) setResult({ key, speculosApps });
        });
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deviceType, version, hasEmulator, key]);

  if (!version) return { status: "idle" };
  if (!hasEmulator) return LOADED_WITHOUT_CATALOGUE;
  const speculosApps =
    cache.get(key) ?? (result?.key === key ? result.speculosApps : undefined);
  return speculosApps === undefined
    ? { status: "loading" }
    : { status: "loaded", speculosApps };
}

const LOADED_WITHOUT_CATALOGUE: DeviceCatalog = {
  status: "loaded",
  speculosApps: null,
};
