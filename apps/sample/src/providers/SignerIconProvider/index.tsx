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
  type SignerIcon,
  SignerIconBuilder,
} from "@ledgerhq/device-signer-kit-icon";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerIconContextType = {
  signer: SignerIcon | null;
};

const initialState: SignerIconContextType = {
  signer: null,
};

const SignerIconContext = createContext<SignerIconContextType>(initialState);

export const SignerIconProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerIcon | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerIconBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerIconContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerIconContext.Provider>
  );
};

export const useSignerIcon = (): SignerIcon | null => {
  return useContext(SignerIconContext).signer;
};
