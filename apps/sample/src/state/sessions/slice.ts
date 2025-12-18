import {
  type ConnectedDevice,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { initialState } from "./schema";

export const sessionsSlice = createSlice({
  name: "sessions",
  reducerPath: "sessions",
  initialState,
  reducers: {
    addSession: (
      state,
      action: PayloadAction<{
        sessionId: DeviceSessionId;
        connectedDevice: ConnectedDevice;
      }>,
    ) => {
      if (state.connectedDevices[action.payload.sessionId]) {
        return;
      }
      state.activeSessions.push(action.payload.sessionId);
      state.connectedDevices[action.payload.sessionId] =
        action.payload.connectedDevice;
      state.selectedSessionId = action.payload.sessionId;
    },
    removeSession: (
      state,
      action: PayloadAction<{ sessionId: DeviceSessionId }>,
    ) => {
      state.activeSessions = state.activeSessions.filter(
        (sessionId) => sessionId !== action.payload.sessionId,
      );
      delete state.connectedDevices[action.payload.sessionId];
      if (state.selectedSessionId === action.payload.sessionId) {
        state.selectedSessionId = null;
      }
    },
    removeAllSessions: (state) => {
      state.activeSessions = [];
      state.connectedDevices = {};
    },
    setSelectedSession: (
      state,
      action: PayloadAction<{ sessionId: DeviceSessionId }>,
    ) => {
      state.selectedSessionId = action.payload.sessionId;
    },
    unsetSelectedSession: (state) => {
      state.selectedSessionId = null;
    },
  },
});

export const {
  addSession,
  removeSession,
  removeAllSessions,
  setSelectedSession,
  unsetSelectedSession,
} = sessionsSlice.actions;

export const sessionsReducer = sessionsSlice.reducer;
