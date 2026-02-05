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
  type SignerTezos,
  SignerTezosBuilder,
} from "@ledgerhq/device-signer-kit-tezos";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerTezosContextType = {
  signer: SignerTezos | null;
};

const initialState: SignerTezosContextType = {
  signer: null,
};

const SignerTezosContext = createContext<SignerTezosContextType>(initialState);

export const SignerTezosProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerTezos | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerTezosBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerTezosContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerTezosContext.Provider>
  );
};

export const useSignerTezos = (): SignerTezos | null => {
  return useContext(SignerTezosContext).signer;
};
