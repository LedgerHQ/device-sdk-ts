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
  type SignerPolkadot,
  SignerPolkadotBuilder,
} from "@ledgerhq/device-signer-kit-polkadot";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerPolkadotContextType = {
  signer: SignerPolkadot | null;
};

const initialState: SignerPolkadotContextType = {
  signer: null,
};

const SignerPolkadotContext = createContext<SignerPolkadotContextType>(initialState);

export const SignerPolkadotProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerPolkadot | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerPolkadotBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerPolkadotContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerPolkadotContext.Provider>
  );
};

export const useSignerPolkadot = (): SignerPolkadot | null => {
  return useContext(SignerPolkadotContext).signer;
};
