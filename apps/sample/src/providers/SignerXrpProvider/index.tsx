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
  type SignerXrp,
  SignerXrpBuilder,
} from "@ledgerhq/device-signer-kit-xrp";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type SignerXrpContextType = {
  signer: SignerXrp | null;
};

const initialState: SignerXrpContextType = {
  signer: null,
};

const SignerXrpContext = createContext<SignerXrpContextType>(initialState);

export const SignerXrpProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerXrp | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const newSigner = new SignerXrpBuilder({
      dmk,
      sessionId,
    }).build();
    setSigner(newSigner);
  }, [dmk, sessionId]);

  return (
    <SignerXrpContext.Provider
      value={{
        signer,
      }}
    >
      {children}
    </SignerXrpContext.Provider>
  );
};

export const useSignerXrp = (): SignerXrp | null => {
  return useContext(SignerXrpContext).signer;
};
