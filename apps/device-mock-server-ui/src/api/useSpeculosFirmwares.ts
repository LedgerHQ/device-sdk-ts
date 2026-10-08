import { useEffect, useState } from "react";

import { api } from "@/api/client";
import { findModel } from "@/domain/devices";
import { byNewest } from "@/domain/versions";

/** Fetched once per model and kept for the page's lifetime. */
const cache = new Map<string, string[]>();

/**
 * Firmware versions Speculos can boot for a model, newest first; `undefined`
 * while they load, and `null` when there is no list to offer: the model has
 * no emulator, the server has no Speculos operator, or Speculinho is down.
 */
export function useSpeculosFirmwares(
  deviceType: string,
): string[] | null | undefined {
  // Kept with the model it is for, so a model switch never shows the last
  // model's list for a render.
  const [result, setResult] = useState<{
    readonly deviceType: string;
    readonly firmwares: string[] | null;
  } | null>(null);
  const hasEmulator = findModel(deviceType)?.speculos === true;

  useEffect(() => {
    if (!hasEmulator || cache.has(deviceType)) return;

    let cancelled = false;
    void api
      .speculosFirmwares(deviceType)
      .then(({ firmware }) => {
        const firmwares = [...firmware].sort(byNewest);
        cache.set(deviceType, firmwares);
        return firmwares;
      })
      .catch(() => null)
      .then((firmwares) => {
        if (!cancelled) setResult({ deviceType, firmwares });
      });
    return () => {
      cancelled = true;
    };
  }, [deviceType, hasEmulator]);

  if (!hasEmulator) return null;
  return (
    cache.get(deviceType) ??
    (result?.deviceType === deviceType ? result.firmwares : undefined)
  );
}
