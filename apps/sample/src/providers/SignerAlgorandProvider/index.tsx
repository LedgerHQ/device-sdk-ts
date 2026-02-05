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
  type SignerAlgorand,
  SignerAlgorandBuilder,
} from "@ledgerhq/device-signer-kit-algorand";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerAlgorandContextType = {
  signer: SignerAlgorand | null;
};

const initialState: SignerAlgorandContextType = {
  signer: null,
};

const SignerAlgorandContext = createContext<SignerAlgorandContextType>(initialState);

export const SignerAlgorandProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerAlgorand | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerAlgorandBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerAlgorandContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerAlgorandContext.Provider>
  );
};

export const useSignerAlgorand = (): SignerAlgorand | null => {
  return useContext(SignerAlgorandContext).signer;
};
