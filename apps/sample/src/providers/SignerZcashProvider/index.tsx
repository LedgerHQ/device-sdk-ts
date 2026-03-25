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
  type SignerZcash,
  SignerZcashBuilder,
} from "@ledgerhq/device-signer-kit-zcash";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerZcashContextType = {
  signer: SignerZcash | null;
};

const initialState: SignerZcashContextType = {
  signer: null,
};

const SignerZcashContext = createContext<SignerZcashContextType>(initialState);

export const SignerZcashProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerZcash | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerZcashBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerZcashContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerZcashContext.Provider>
  );
};

export const useSignerZcash = (): SignerZcash | null => {
  return useContext(SignerZcashContext).signer;
};
