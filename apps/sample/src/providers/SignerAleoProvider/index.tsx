"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSelector } from "react-redux";
import { ContextModuleBuilder } from "@ledgerhq/context-module";
import {
  type SignerAleo,
  SignerAleoBuilder,
} from "@ledgerhq/device-signer-kit-aleo";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";
import { selectCalConfig } from "@/state/settings/selectors";

type SignerAleoContextType = {
  signer: SignerAleo | null;
};

const initialState: SignerAleoContextType = {
  signer: null,
};

const SignerAleoContext = createContext<SignerAleoContextType>(initialState);

export const SignerAleoProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);
  const calConfig = useSelector(selectCalConfig);

  const [signer, setSigner] = useState<SignerAleo | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const contextModule = new ContextModuleBuilder({
      loggerFactory: (tag: string) =>
        dmk.getLoggerFactory()(["ContextModule", tag]),
    })
      .setCalConfig(calConfig)
      .build();

    const newSigner = new SignerAleoBuilder({
      dmk,
      sessionId,
    })
      .withContextModule(contextModule)
      .build();
    setSigner(newSigner);
  }, [calConfig, dmk, sessionId]);

  return (
    <SignerAleoContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerAleoContext.Provider>
  );
};

export const useSignerAleo = (): SignerAleo | null => {
  return useContext(SignerAleoContext).signer;
};
