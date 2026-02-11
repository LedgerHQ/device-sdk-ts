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
  type SignerStellar,
  SignerStellarBuilder,
} from "@ledgerhq/device-signer-kit-stellar";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerStellarContextType = {
  signer: SignerStellar | null;
};

const initialState: SignerStellarContextType = {
  signer: null,
};

const SignerStellarContext = createContext<SignerStellarContextType>(initialState);

export const SignerStellarProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerStellar | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerStellarBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerStellarContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerStellarContext.Provider>
  );
};

export const useSignerStellar = (): SignerStellar | null => {
  return useContext(SignerStellarContext).signer;
};
