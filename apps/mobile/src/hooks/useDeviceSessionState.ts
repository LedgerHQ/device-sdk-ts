import { useEffect, useState } from "react";
import {
  DeviceSessionId,
  DeviceSessionState,
  DeviceStatus,
} from "@ledgerhq/device-management-kit";

import { useDmk } from "_providers/dmkProvider";
// import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

export function useDeviceSessionState(sessionId: DeviceSessionId) {
  const dmk = useDmk();
  const [deviceSessionState, setDeviceSessionState] =
    useState<DeviceSessionState>();
  // const { dispatch } = useDeviceSessionsContext();

  useEffect(() => {
    if (sessionId) {
      const subscription = dmk
        .getDeviceSessionState({
          sessionId,
        })
        .subscribe(state => {
          if (state.deviceStatus === DeviceStatus.NOT_CONNECTED) {
            // dispatch({ type: "remove_session", payload: { sessionId } });
          } else {
            setDeviceSessionState(state);
          }
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [sessionId, dmk]);

  return deviceSessionState;
}
