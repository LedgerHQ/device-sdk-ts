import { useEffect, useState } from "react";
import {
  type DeviceSessionId,
  type DeviceSessionState,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useRemoveSession } from "@/state/sessions/hooks";

import { useThrottle } from "./useThrottle";

export function useDeviceSessionState(sessionId: DeviceSessionId) {
  const dmk = useDmk();
  const [deviceSessionState, setDeviceSessionState] =
    useState<DeviceSessionState>();
  const removeSession = useRemoveSession();

  useEffect(() => {
    if (sessionId) {
      const subscription = dmk
        .getDeviceSessionState({
          sessionId,
        })
        .subscribe((state) => {
          if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
            removeSession(sessionId);
          } else {
            setDeviceSessionState(state);
          }
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [sessionId, dmk]);

  return useThrottle(deviceSessionState, 500);
}
