import React from "react";
import { createContext, useContext, useReducer } from "react";

import {
  type SdkConfigAction,
  SdkConfigInitialState,
  sdkConfigReducer,
  type SdkConfigState,
} from "@/reducers/sdkConfig";

type SdkConfigContextType = {
  state: SdkConfigState;
  dispatch: (value: SdkConfigAction) => void;
};

const SdkConfigContext = createContext<SdkConfigContextType>({
  state: SdkConfigInitialState,
  dispatch: () => null,
});

export const SdkConfigProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [state, dispatch] = useReducer(sdkConfigReducer, SdkConfigInitialState);

  return (
    <SdkConfigContext.Provider value={{ state, dispatch }}>
      {children}
    </SdkConfigContext.Provider>
  );
};

export const useSdkConfigContext = () =>
  useContext<SdkConfigContextType>(SdkConfigContext);
