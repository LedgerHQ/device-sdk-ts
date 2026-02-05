import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { type DeviceSessionId } from "@ledgerhq/device-management-kit";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { addSession, removeAllSessions } from "@/state/sessions/slice";
import { selectBypassIntentQueue } from "@/state/settings/selectors";

export function useUpdateDeviceSessions() {
  const dmk = useDmk();
  const dispatch = useDispatch();
  const bypassIntentQueue = useSelector(selectBypassIntentQueue);
  const sessionIdsRef = useRef<Set<DeviceSessionId>>(new Set());

  useEffect(() => {
    const subscription = dmk
      .listenToConnectedDevice()
      .subscribe((connectedDevice) => {
        sessionIdsRef.current.add(connectedDevice.sessionId);
        // Apply bypass intent queue setting to new session
        dmk._unsafeBypassIntentQueue({
          sessionId: connectedDevice.sessionId,
          bypass: bypassIntentQueue,
        });
        dispatch(
          addSession({ sessionId: connectedDevice.sessionId, connectedDevice }),
        );
      });
    return () => {
      subscription.unsubscribe();
      sessionIdsRef.current.clear();
      dispatch(removeAllSessions());
    };
  }, [dmk, dispatch, bypassIntentQueue]);

  // Apply bypass setting changes to all existing sessions
  useEffect(() => {
    sessionIdsRef.current.forEach((sessionId) => {
      dmk._unsafeBypassIntentQueue({
        sessionId,
        bypass: bypassIntentQueue,
      });
    });
  }, [dmk, bypassIntentQueue]);
}
