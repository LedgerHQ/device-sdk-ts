import React, {
  type Context,
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";

import { useHasChanged } from "@/hooks/useHasChanged";
import { useSdk } from "@/providers/DeviceSdkProvider";
import {
  type DeviceSessionsAction,
  DeviceSessionsInitialState,
  deviceSessionsReducer,
  type DeviceSessionsState,
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

  const sdkHasChanged = useHasChanged(sdk);
  if (sdkHasChanged) {
    dispatch({ type: "remove_all_sessions" });
  }

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
  }, [sdk]);

  return (
    <DeviceSessionsContext.Provider value={{ state, dispatch }}>
      {children}
    </DeviceSessionsContext.Provider>
  );
};

export const useDeviceSessionsContext = () =>
  useContext<DeviceSessionsContextType>(DeviceSessionsContext);
