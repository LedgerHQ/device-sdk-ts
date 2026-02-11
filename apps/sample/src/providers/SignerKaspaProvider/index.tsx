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
  type SignerKaspa,
  SignerKaspaBuilder,
} from "@ledgerhq/device-signer-kit-kaspa";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerKaspaContextType = {
  signer: SignerKaspa | null;
};

const initialState: SignerKaspaContextType = {
  signer: null,
};

const SignerKaspaContext = createContext<SignerKaspaContextType>(initialState);

export const SignerKaspaProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerKaspa | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerKaspaBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerKaspaContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerKaspaContext.Provider>
  );
};

export const useSignerKaspa = (): SignerKaspa | null => {
  return useContext(SignerKaspaContext).signer;
};
