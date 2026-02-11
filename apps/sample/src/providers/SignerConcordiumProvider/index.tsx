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
  type SignerConcordium,
  SignerConcordiumBuilder,
} from "@ledgerhq/device-signer-kit-concordium";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerConcordiumContextType = {
  signer: SignerConcordium | null;
};

const initialState: SignerConcordiumContextType = {
  signer: null,
};

const SignerConcordiumContext = createContext<SignerConcordiumContextType>(initialState);

export const SignerConcordiumProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerConcordium | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerConcordiumBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerConcordiumContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerConcordiumContext.Provider>
  );
};

export const useSignerConcordium = (): SignerConcordium | null => {
  return useContext(SignerConcordiumContext).signer;
};
