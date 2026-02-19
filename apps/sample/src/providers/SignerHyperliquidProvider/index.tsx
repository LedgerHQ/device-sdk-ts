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
  type SignerHyperliquid,
  SignerHyperliquidBuilder,
} from "@ledgerhq/device-signer-kit-hyperliquid";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerHyperliquidContextType = {
  signer: SignerHyperliquid | null;
};

const initialState: SignerHyperliquidContextType = {
  signer: null,
};

const SignerHyperliquidContext =
  createContext<SignerHyperliquidContextType>(initialState);

export const SignerHyperliquidProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerHyperliquid | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerHyperliquidBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerHyperliquidContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerHyperliquidContext.Provider>
  );
};

export const useSignerHyperliquid = (): SignerHyperliquid | null => {
  return useContext(SignerHyperliquidContext).signer;
};
