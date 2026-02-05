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
  type SignerCanton,
  SignerCantonBuilder,
} from "@ledgerhq/device-signer-kit-canton";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerCantonContextType = {
  signer: SignerCanton | null;
};

const initialState: SignerCantonContextType = {
  signer: null,
};

const SignerCantonContext = createContext<SignerCantonContextType>(initialState);

export const SignerCantonProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerCanton | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerCantonBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerCantonContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerCantonContext.Provider>
  );
};

export const useSignerCanton = (): SignerCanton | null => {
  return useContext(SignerCantonContext).signer;
};
