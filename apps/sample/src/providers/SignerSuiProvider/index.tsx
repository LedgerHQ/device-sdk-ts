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
  type SignerSui,
  SignerSuiBuilder,
} from "@ledgerhq/device-signer-kit-sui";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerSuiContextType = {
  signer: SignerSui | null;
};

const initialState: SignerSuiContextType = {
  signer: null,
};

const SignerSuiContext = createContext<SignerSuiContextType>(initialState);

export const SignerSuiProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerSui | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerSuiBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerSuiContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerSuiContext.Provider>
  );
};

export const useSignerSui = (): SignerSui | null => {
  return useContext(SignerSuiContext).signer;
};
