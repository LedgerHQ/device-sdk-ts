import { useEffect, useState } from "react";
import {
  DeviceSessionId,
  DeviceSessionState,
  DeviceStatus,
} from "@ledgerhq/device-sdk-core";

import { useSdk } from "@/providers/DeviceSdkProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

export function useDeviceSessionState(sessionId: DeviceSessionId) {
  const sdk = useSdk();
  const [deviceSessionState, setDeviceSessionState] =
    useState<DeviceSessionState>();
  const { dispatch } = useDeviceSessionsContext();

  useEffect(() => {
    if (sessionId) {
      const subscription = sdk
        .getDeviceSessionState({
          sessionId,
        })
        .subscribe((state) => {
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
  }, [sessionId, sdk, dispatch]);

  return deviceSessionState;
}
