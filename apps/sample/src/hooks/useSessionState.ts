import { useEffect, useState } from "react";
import { SessionDeviceState, SessionId } from "@ledgerhq/device-sdk-core";

import { useSdk } from "@/providers/DeviceSdkProvider";

export function useSessionState(sessionId: SessionId) {
  const sdk = useSdk();
  const [sessionState, setSessionState] = useState<SessionDeviceState>();

  useEffect(() => {
    if (sessionId) {
      const subscription = sdk
        .getSessionDeviceState({
          sessionId,
        })
        .subscribe((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          setSessionState(state);
        });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [sessionId, sdk]);

  return sessionState;
}
