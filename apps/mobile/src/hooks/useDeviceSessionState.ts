import { useEffect, useState } from "react";
import { useDeviceSessionsContext } from "_providers/deviceSessionsProvider.tsx";
import { useDmk } from "_providers/dmkProvider";
import {
  type DeviceSessionId,
  type DeviceSessionState,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

export function useDeviceSessionState(sessionId: DeviceSessionId) {
  const dmk = useDmk();
  const [deviceSessionState, setDeviceSessionState] =
    useState<DeviceSessionState>();
  const { dispatch } = useDeviceSessionsContext();

  useEffect(() => {
    if (sessionId) {
      const subscription = dmk
        .getDeviceSessionState({
          sessionId,
        })
        .subscribe(state => {
          if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
            dispatch({ type: "remove_session", payload: { sessionId } });
          } else {
            setDeviceSessionState(state);
          }
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [sessionId, dmk, dispatch]);

  return deviceSessionState;
}
