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

export const SessionsInitialState: SessionsState = {
  selectedId: null,
  deviceById: {},
};

export const sessionsReducer: Reducer<SessionsState, AddSessionAction> = (
  state,
  action,
) => {
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
    default:
      return state;
  }
};
