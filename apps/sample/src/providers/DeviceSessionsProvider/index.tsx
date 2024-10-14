import React, { Context, createContext, useContext, useReducer } from "react";

import {
  DeviceSessionsInitialState,
  deviceSessionsReducer,
  DeviceSessionsState,
  DeviseSessionsAction,
} from "@/reducers/deviceSessions";

type DeviceSessionsContextType = {
  state: DeviceSessionsState;
  dispatch: (value: DeviseSessionsAction) => void;
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
