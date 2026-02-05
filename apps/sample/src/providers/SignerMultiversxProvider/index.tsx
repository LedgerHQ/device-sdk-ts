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
  type SignerMultiversx,
  SignerMultiversxBuilder,
} from "@ledgerhq/device-signer-kit-multiversx";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerMultiversxContextType = {
  signer: SignerMultiversx | null;
};

const initialState: SignerMultiversxContextType = {
  signer: null,
};

const SignerMultiversxContext = createContext<SignerMultiversxContextType>(initialState);

export const SignerMultiversxProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerMultiversx | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerMultiversxBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerMultiversxContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerMultiversxContext.Provider>
  );
};

export const useSignerMultiversx = (): SignerMultiversx | null => {
  return useContext(SignerMultiversxContext).signer;
};
