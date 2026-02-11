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
  type SignerHedera,
  SignerHederaBuilder,
} from "@ledgerhq/device-signer-kit-hedera";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerHederaContextType = {
  signer: SignerHedera | null;
};

const initialState: SignerHederaContextType = {
  signer: null,
};

const SignerHederaContext = createContext<SignerHederaContextType>(initialState);

export const SignerHederaProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerHedera | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerHederaBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerHederaContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerHederaContext.Provider>
  );
};

export const useSignerHedera = (): SignerHedera | null => {
  return useContext(SignerHederaContext).signer;
};
