import React, {
  Context,
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";

import { useSdk } from "@/providers/DeviceSdkProvider";
import {
  DeviceSessionsAction,
  DeviceSessionsInitialState,
  deviceSessionsReducer,
  DeviceSessionsState,
} from "@/reducers/deviceSessions";

type DeviceSessionsContextType = {
  state: DeviceSessionsState;
  dispatch: (value: DeviceSessionsAction) => void;
};

const DeviceSessionsContext: Context<DeviceSessionsContextType> =
  createContext<DeviceSessionsContextType>({
    state: DeviceSessionsInitialState,
    dispatch: () => null,
  });

export const DeviceSessionsProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const sdk = useSdk();
  const [state, dispatch] = useReducer(
    deviceSessionsReducer,
    DeviceSessionsInitialState,
  );

  useEffect(() => {
    sdk.listDeviceSessions().map((session) => {
      dispatch({
        type: "add_session",
        payload: {
          sessionId: session.id,
          connectedDevice: sdk.getConnectedDevice({ sessionId: session.id }),
        },
      });
    });
    return () => {
      dispatch({ type: "remove_all_sessions" });
    };
  }, [sdk]);

  return (
    <DeviceSessionsContext.Provider value={{ state, dispatch }}>
      {children}
    </DeviceSessionsContext.Provider>
  );
};

export const useDeviceSessionsContext = () =>
  useContext<DeviceSessionsContextType>(DeviceSessionsContext);
