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
  type SignerHelium,
  SignerHeliumBuilder,
} from "@ledgerhq/device-signer-kit-helium";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerHeliumContextType = {
  signer: SignerHelium | null;
};

const initialState: SignerHeliumContextType = {
  signer: null,
};

const SignerHeliumContext = createContext<SignerHeliumContextType>(initialState);

export const SignerHeliumProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerHelium | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerHeliumBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerHeliumContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerHeliumContext.Provider>
  );
};

export const useSignerHelium = (): SignerHelium | null => {
  return useContext(SignerHeliumContext).signer;
};
