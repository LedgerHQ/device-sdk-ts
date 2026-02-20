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
  type SignerCosmos,
  SignerCosmosBuilder,
} from "@ledgerhq/device-signer-kit-cosmos";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerCosmosContextType = {
  signer: SignerCosmos | null;
};

const initialState: SignerCosmosContextType = {
  signer: null,
};

const SignerCosmosContext =
  createContext<SignerCosmosContextType>(initialState);

export const SignerCosmosProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerCosmos | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerCosmosBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerCosmosContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerCosmosContext.Provider>
  );
};

export const useSignerCosmos = (): SignerCosmos | null => {
  return useContext(SignerCosmosContext).signer;
};
