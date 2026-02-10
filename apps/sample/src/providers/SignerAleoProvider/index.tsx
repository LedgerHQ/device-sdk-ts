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
  type SignerAleo,
  SignerAleoBuilder,
} from "@ledgerhq/device-signer-kit-aleo";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

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

  const [signer, setSigner] = useState<SignerAleo | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerAleoBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

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
