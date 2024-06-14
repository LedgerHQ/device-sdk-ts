import { Reducer } from "react";
import { ConnectedDevice, DeviceSessionId } from "@ledgerhq/device-sdk-core";

export type DeviceSessionsState = {
  selectedId: DeviceSessionId | null;
  deviceById: Record<DeviceSessionId, ConnectedDevice>;
};

export type AddSessionAction = {
  type: "add_session";
  payload: { sessionId: DeviceSessionId; connectedDevice: ConnectedDevice };
};

export type RemoveSessionAction = {
  type: "remove_session";
  payload: { sessionId: DeviceSessionId };
};

export const DeviceSessionsInitialState: DeviceSessionsState = {
  selectedId: null,
  deviceById: {},
};

export const deviceSessionsReducer: Reducer<
  DeviceSessionsState,
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
