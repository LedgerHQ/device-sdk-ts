import { type Reducer } from "react";
import {
  type ConnectedDevice,
  type DeviceSessionId,
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

type RemoveAllSessionsAction = {
  type: "remove_all_sessions";
};

export type DeviceSessionsAction =
  | AddSessionAction
  | RemoveSessionAction
  | SelectSessionAction
  | RemoveAllSessionsAction;

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
  DeviceSessionsAction
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
    case "remove_all_sessions":
      return DeviceSessionsInitialState;

    case "select_session":
      return {
        ...state,
        selectedId: action.payload.sessionId,
      };
    default:
      return state;
  }
};
