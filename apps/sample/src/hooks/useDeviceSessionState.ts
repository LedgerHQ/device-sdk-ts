import { useEffect, useState } from "react";
import { DeviceSessionId, DeviceSessionState } from "@ledgerhq/device-sdk-core";

import { useSdk } from "@/providers/DeviceSdkProvider";

export function useDeviceSessionState(sessionId: DeviceSessionId) {
  const sdk = useSdk();
  const [deviceSessionState, setDeviceSessionState] =
    useState<DeviceSessionState>();

  useEffect(() => {
    if (sessionId) {
      const subscription = sdk
        .getDeviceSessionState({
          sessionId,
        })
        .subscribe((state) => {
          setDeviceSessionState(state);
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [sessionId, sdk]);

  return deviceSessionState;
}
