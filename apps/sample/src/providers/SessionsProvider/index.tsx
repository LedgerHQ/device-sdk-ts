import { Context, createContext, useContext, useReducer } from "react";

import {
  AddSessionAction,
  RemoveSessionAction,
  SessionsInitialState,
  sessionsReducer,
  SessionsState,
} from "@/reducers/sessions";

type SessionContextType = {
  state: SessionsState;
  dispatch: (value: AddSessionAction | RemoveSessionAction) => void;
};

const SessionContext: Context<SessionContextType> =
  createContext<SessionContextType>({
    state: SessionsInitialState,
    dispatch: () => null,
  });

export const SessionProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(sessionsReducer, SessionsInitialState);

  return (
    <SessionContext.Provider value={{ state, dispatch }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSessionContext = () =>
  useContext<SessionContextType>(SessionContext);
