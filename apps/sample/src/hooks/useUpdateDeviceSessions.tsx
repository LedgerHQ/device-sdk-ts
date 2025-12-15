import { useEffect } from "react";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useAddSession, useRemoveAllSessions } from "@/state/sessions/hooks";

export function useUpdateDeviceSessions() {
  const dmk = useDmk();
  const addSession = useAddSession();
  const removeAllSessions = useRemoveAllSessions();

  useEffect(() => {
    const subscription = dmk
      .listenToConnectedDevice()
      .subscribe((connectedDevice) => {
        addSession(connectedDevice.sessionId, connectedDevice);
      });
    return () => {
      subscription.unsubscribe();
      removeAllSessions();
    };
  }, [dmk, addSession, removeAllSessions]);
}
