import { Reducer } from "react";
import {
  ConnectedDevice,
  DeviceSessionId,
} from "@ledgerhq/device-management-kit";

export type DeviceSessionsState = {
  selectedId?: DeviceSessionId;
  deviceById: Record<DeviceSessionId, ConnectedDevice>;
};

type AddSessionAction = {
  type: "add_session";
  payload: { sessionId: DeviceSessionId; connectedDevice: ConnectedDevice };
};

type RemoveSessionAction = {
  type: "remove_session";
  payload: { sessionId: DeviceSessionId };
};

export type DeviseSessionsAction =
  | AddSessionAction
  | RemoveSessionAction
  | SelectSessionAction;

export type SelectSessionAction = {
  type: "select_session";
  payload: { sessionId: DeviceSessionId };
};

export const DeviceSessionsInitialState: DeviceSessionsState = {
  selectedId: undefined,
  deviceById: {},
};

export const deviceSessionsReducer: Reducer<
  DeviceSessionsState,
  DeviseSessionsAction
> = (state, action) => {
  const sessionsCount = Object.keys(state.deviceById).length;

  switch (action.type) {
    case "add_session":
      return {
        ...state,
        selectedId: action.payload.sessionId,
        deviceById: {
          ...state.deviceById,
          [action.payload.sessionId]: action.payload.connectedDevice,
        },
      };
    case "remove_session":
      delete state.deviceById[action.payload.sessionId];

      return {
        ...state,
        selectedId:
          sessionsCount > 0
            ? Object.keys(state.deviceById)[sessionsCount - 1]
            : undefined,
      };
    case "select_session":
      return {
        ...state,
        selectedId: action.payload.sessionId,
      };
    default:
      return state;
  }
};
