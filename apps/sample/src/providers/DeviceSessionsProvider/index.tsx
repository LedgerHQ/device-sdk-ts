import React, { Context, createContext, useContext, useReducer } from "react";

import {
  AddSessionAction,
  DeviceSessionsInitialState,
  deviceSessionsReducer,
  DeviceSessionsState,
  RemoveSessionAction,
} from "@/reducers/deviceSessions";

type DeviceSessionsContextType = {
  state: DeviceSessionsState;
  dispatch: (value: AddSessionAction | RemoveSessionAction) => void;
};

const DeviceSessionsContext: Context<DeviceSessionsContextType> =
  createContext<DeviceSessionsContextType>({
    state: DeviceSessionsInitialState,
    dispatch: () => null,
  });

export const DeviceSessionsProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(
    deviceSessionsReducer,
    DeviceSessionsInitialState,
  );

  return (
    <DeviceSessionsContext.Provider value={{ state, dispatch }}>
      {children}
    </DeviceSessionsContext.Provider>
  );
};

export const useDeviceSessionsContext = () =>
  useContext<DeviceSessionsContextType>(DeviceSessionsContext);
