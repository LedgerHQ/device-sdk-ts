import { Reducer } from "react";
import { ConnectedDevice, SessionId } from "@ledgerhq/device-sdk-core";

export type SessionsState = {
  selectedId: SessionId | null;
  deviceById: Record<SessionId, ConnectedDevice>;
};

export type AddSessionAction = {
  type: "add_session";
  payload: { sessionId: SessionId; connectedDevice: ConnectedDevice };
};

export type RemoveSessionAction = {
  type: "remove_session";
  payload: { sessionId: SessionId };
};

export const SessionsInitialState: SessionsState = {
  selectedId: null,
  deviceById: {},
};

export const sessionsReducer: Reducer<
  SessionsState,
  AddSessionAction | RemoveSessionAction
> = (state, action) => {
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
        selectedId: null,
      };
    default:
      return state;
  }
};
