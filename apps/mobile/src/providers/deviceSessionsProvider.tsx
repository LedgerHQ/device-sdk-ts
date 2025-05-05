import React, {
  type Context,
  createContext,
  useContext,
  useEffect,
  useReducer,
} from "react";
import { useHasChanged } from "_hooks/useHasChanged";
import { useDmk } from "_providers/dmkProvider.tsx";
import {
  type DeviceSessionsAction,
  DeviceSessionsInitialState,
  deviceSessionsReducer,
  type DeviceSessionsState,
} from "_reducers/deviceSessionsReducer.ts";

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
  const dmk = useDmk();
  const [state, dispatch] = useReducer(
    deviceSessionsReducer,
    DeviceSessionsInitialState,
  );

  const dmkHasChanged = useHasChanged(dmk);
  if (dmkHasChanged) {
    dispatch({ type: "remove_all_sessions" });
  }

  useEffect(() => {
    const subscription = dmk
      .listenToConnectedDevice()
      .subscribe(connectedDevice => {
        dispatch({
          type: "add_session",
          payload: {
            sessionId: connectedDevice.sessionId,
            connectedDevice,
          },
        });
      });
    return () => {
      subscription.unsubscribe();
    };
  }, [dmk]);

  return (
    <DeviceSessionsContext.Provider value={{ state, dispatch }}>
      {children}
    </DeviceSessionsContext.Provider>
  );
};

export const useDeviceSessionsContext = () =>
  useContext<DeviceSessionsContextType>(DeviceSessionsContext);
