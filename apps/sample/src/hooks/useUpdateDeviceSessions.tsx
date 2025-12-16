import { useEffect } from "react";
import { useDispatch } from "react-redux";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { addSession, removeAllSessions } from "@/state/sessions/slice";

export function useUpdateDeviceSessions() {
  const dmk = useDmk();
  const dispatch = useDispatch();

  useEffect(() => {
    const subscription = dmk
      .listenToConnectedDevice()
      .subscribe((connectedDevice) => {
        dispatch(
          addSession({ sessionId: connectedDevice.sessionId, connectedDevice }),
        );
      });
    return () => {
      subscription.unsubscribe();
      dispatch(removeAllSessions());
    };
  }, [dmk, dispatch]);
}
