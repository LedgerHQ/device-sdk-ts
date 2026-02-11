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
  type SignerCelo,
  SignerCeloBuilder,
} from "@ledgerhq/device-signer-kit-celo";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerCeloContextType = {
  signer: SignerCelo | null;
};

const initialState: SignerCeloContextType = {
  signer: null,
};

const SignerCeloContext = createContext<SignerCeloContextType>(initialState);

export const SignerCeloProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerCelo | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerCeloBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerCeloContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerCeloContext.Provider>
  );
};

export const useSignerCelo = (): SignerCelo | null => {
  return useContext(SignerCeloContext).signer;
};
