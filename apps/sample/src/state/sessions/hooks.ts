import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  type ConnectedDevice,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import {
  selectOrderedConnectedDevices,
  selectSelectedSessionId,
} from "./selectors";
import {
  addSession,
  removeAllSessions,
  removeSession,
  setSelectedSession,
} from "./slice";

export function useSelectedSessionId() {
  const selectedSessionId = useSelector(selectSelectedSessionId);
  return selectedSessionId;
}

export function useOrderedConnectedDevices() {
  const orderedConnectedDevices = useSelector(selectOrderedConnectedDevices);
  return orderedConnectedDevices;
}

export function useSelectSession() {
  const dispatch = useDispatch();
  return useCallback(
    (sessionId: DeviceSessionId) => {
      dispatch(setSelectedSession({ sessionId }));
    },
    [dispatch],
  );
}

export function useAddSession() {
  const dispatch = useDispatch();
  return useCallback(
    (sessionId: DeviceSessionId, connectedDevice: ConnectedDevice) => {
      dispatch(addSession({ sessionId, connectedDevice }));
    },
    [dispatch],
  );
}

export function useRemoveSession() {
  const dispatch = useDispatch();
  return useCallback(
    (sessionId: DeviceSessionId) => {
      dispatch(removeSession({ sessionId }));
    },
    [dispatch],
  );
}

export function useRemoveAllSessions() {
  const dispatch = useDispatch();
  return useCallback(() => {
    dispatch(removeAllSessions());
  }, [dispatch]);
}
