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
  type SignerAptos,
  SignerAptosBuilder,
} from "@ledgerhq/device-signer-kit-aptos";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerAptosContextType = {
  signer: SignerAptos | null;
};

const initialState: SignerAptosContextType = {
  signer: null,
};

const SignerAptosContext = createContext<SignerAptosContextType>(initialState);

export const SignerAptosProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerAptos | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerAptosBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerAptosContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerAptosContext.Provider>
  );
};

export const useSignerAptos = (): SignerAptos | null => {
  return useContext(SignerAptosContext).signer;
};
