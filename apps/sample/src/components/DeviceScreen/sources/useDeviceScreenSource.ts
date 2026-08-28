/**
 * src/components/DeviceScreen/sources/useDeviceScreenSource.ts
 *
 * The only place the transport decides where the device screen comes from.
 * Both apis are hooks, so both run unconditionally and the unused one idles.
 */
"use client";

import { useSelector } from "react-redux";

import { type DeviceScreenState } from "@/components/DeviceScreen/sources/types";
import { useMockServerScreenApi } from "@/components/DeviceScreen/sources/useMockServerScreenApi";
import { useScreenPolling } from "@/components/DeviceScreen/sources/useScreenPolling";
import { useSpeculosScreenApi } from "@/components/DeviceScreen/sources/useSpeculosScreenApi";
import { selectTransportType } from "@/state/settings/selectors";

/**
 * @param live whether the screen is on show. `unavailable` is reserved for
 * transports with no screen at all, so the panel can still render its header
 * while collapsed.
 */
export function useDeviceScreenSource(
  deviceId: string,
  live: boolean,
): DeviceScreenState {
  const transportType = useSelector(selectTransportType);
  const hasScreen =
    transportType === "mockserver" || transportType === "speculos";

  const mockServer = useMockServerScreenApi(deviceId);
  const speculos = useSpeculosScreenApi();

  const state = useScreenPolling(
    transportType === "speculos" ? speculos : mockServer,
    live && hasScreen,
  );

  return hasScreen ? state : { kind: "unavailable" };
}
