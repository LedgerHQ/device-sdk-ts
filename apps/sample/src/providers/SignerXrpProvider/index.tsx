"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSelector } from "react-redux";
import {
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  type SignerXrp,
  SignerXrpBuilder,
} from "@ledgerhq/device-signer-kit-xrp";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";
import { selectCalConfig, selectOriginToken } from "@/state/settings/selectors";

type SignerXrpContextType = {
  signer: SignerXrp | null;
};

const initialState: SignerXrpContextType = {
  signer: null,
};

const SignerXrpContext = createContext<SignerXrpContextType>(initialState);

export const SignerXrpProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerXrp | null>(null);
  const calConfig = useSelector(selectCalConfig);
  const originToken = useSelector(selectOriginToken);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const contextModule = new ContextModuleBuilder({
      originToken,
      loggerFactory: (tag: string) =>
        dmk.getLoggerFactory()(["ContextModule", tag]),
    })
      .setCalConfig(calConfig)
      .setChain(ContextModuleChainID.Xrp)
      .build();
    const newSigner = new SignerXrpBuilder({ dmk, sessionId, originToken })
      .withContextModule(contextModule)
      .build();
    setSigner(newSigner);
  }, [calConfig, dmk, originToken, sessionId]);

  return (
    <SignerXrpContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerXrpContext.Provider>
  );
};

export const useSignerXrp = (): SignerXrp | null => {
  return useContext(SignerXrpContext).signer;
};
