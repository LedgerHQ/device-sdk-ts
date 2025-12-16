import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import {
  type DeviceSessionId,
  type DeviceSessionState,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { removeSession } from "@/state/sessions/slice";

import { useThrottle } from "./useThrottle";

export function useDeviceSessionState(sessionId: DeviceSessionId) {
  const dmk = useDmk();
  const [deviceSessionState, setDeviceSessionState] =
    useState<DeviceSessionState>();
  const dispatch = useDispatch();

  useEffect(() => {
    if (sessionId) {
      const subscription = dmk
        .getDeviceSessionState({
          sessionId,
        })
        .subscribe((state) => {
          if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
            dispatch(removeSession({ sessionId }));
          } else {
            setDeviceSessionState(state);
          }
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [sessionId, dmk, dispatch]);

  return useThrottle(deviceSessionState, 500);
}
