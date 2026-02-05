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
  type SignerNear,
  SignerNearBuilder,
} from "@ledgerhq/device-signer-kit-near";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerNearContextType = {
  signer: SignerNear | null;
};

const initialState: SignerNearContextType = {
  signer: null,
};

const SignerNearContext = createContext<SignerNearContextType>(initialState);

export const SignerNearProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerNear | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerNearBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerNearContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerNearContext.Provider>
  );
};

export const useSignerNear = (): SignerNear | null => {
  return useContext(SignerNearContext).signer;
};
