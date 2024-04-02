import { Context, createContext, Reducer, useContext, useReducer } from "react";
import { ConnectedDevice, SessionId } from "@ledgerhq/device-sdk-core";

type SessionState = {
  list: SessionId[];
  selected: SessionId | null;
  devicesMap: Record<SessionId, ConnectedDevice>;
};

type AddSessionAction = {
  type: "add_session";
  payload: { sessionId: SessionId; connectedDevice: ConnectedDevice };
};

export const SessionsInitialState: SessionState = {
  list: [],
  selected: null,
  devicesMap: {},
};

export const sessionReducer: Reducer<SessionState, AddSessionAction> = (
  state,
  action,
) => {
  switch (action.type) {
    case "add_session":
      return {
        ...state,
        selected: action.payload.sessionId,
        devicesMap: {
          ...state.devicesMap,
          [action.payload.sessionId]: action.payload.connectedDevice,
        },
      };
    default:
      return state;
  }
};

type SessionContextType = {
  state: SessionState;
  dispatch: (value: AddSessionAction) => void;
};

const SessionContext: Context<SessionContextType> =
  createContext<SessionContextType>({
    state: SessionsInitialState,
    dispatch: (value: AddSessionAction) => {},
  });

export const SessionProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(sessionReducer, SessionsInitialState);

  return (
    <SessionContext.Provider value={{ state, dispatch }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSessionContext = () =>
  useContext<SessionContextType>(SessionContext);
