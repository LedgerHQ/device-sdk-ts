import React from "react";
import { createContext, useContext, useReducer } from "react";

import {
  type DmkConfigAction,
  DmkConfigInitialState,
  dmkConfigReducer,
  type DmkConfigState,
} from "@/reducers/dmkConfig";

type DmkConfigContextType = {
  state: DmkConfigState;
  dispatch: (value: DmkConfigAction) => void;
};

const DmkConfigContext = createContext<DmkConfigContextType>({
  state: DmkConfigInitialState,
  dispatch: () => null,
});

export const DmkConfigProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(dmkConfigReducer, DmkConfigInitialState);

  return (
    <DmkConfigContext.Provider value={{ state, dispatch }}>
      {children}
    </DmkConfigContext.Provider>
  );
};

export const useDmkConfigContext = () =>
  useContext<DmkConfigContextType>(DmkConfigContext);
