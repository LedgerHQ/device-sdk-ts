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
  type SignerVechain,
  SignerVechainBuilder,
} from "@ledgerhq/device-signer-kit-vechain";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerVechainContextType = {
  signer: SignerVechain | null;
};

const initialState: SignerVechainContextType = {
  signer: null,
};

const SignerVechainContext = createContext<SignerVechainContextType>(initialState);

export const SignerVechainProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerVechain | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerVechainBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerVechainContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerVechainContext.Provider>
  );
};

export const useSignerVechain = (): SignerVechain | null => {
  return useContext(SignerVechainContext).signer;
};
