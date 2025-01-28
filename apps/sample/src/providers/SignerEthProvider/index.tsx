"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ContextModuleBuilder,
  type ContextModuleCalConfig,
} from "@ledgerhq/context-module";
import {
  type SignerEth,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

type SignerEthContextType = {
  signer: SignerEth | null;
  calConfig: ContextModuleCalConfig;
  setCalConfig: (cal: ContextModuleCalConfig) => void;
};

const initialState: SignerEthContextType = {
  signer: null,
  calConfig: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    web3checksUrl: "https://api.blockaid.io/v0/ledger/transaction/scan",
    mode: "prod",
    branch: "next",
  },
  setCalConfig: () => {},
};

const SignerEthContext = createContext<SignerEthContextType>(initialState);

export const SignerEthProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const {
    state: { selectedId: sessionId },
  } = useDeviceSessionsContext();

  const [signer, setSigner] = useState<SignerEth | null>(null);
  const [calConfig, setCalConfig] = useState<ContextModuleCalConfig>(
    initialState.calConfig,
  );

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const contextModule = new ContextModuleBuilder()
      .addCalConfig(calConfig)
      .build();
    const newSigner = new SignerEthBuilder({ dmk, sessionId })
      .withContextModule(contextModule)
      .build();
    setSigner(newSigner);
  }, [calConfig, dmk, sessionId]);

  return (
    <SignerEthContext.Provider value={{ signer, calConfig, setCalConfig }}>
      {children}
    </SignerEthContext.Provider>
  );
};

export const useSignerEth = (): SignerEth | null => {
  return useContext(SignerEthContext).signer;
};

export const useCalConfig = () => {
  const { calConfig, setCalConfig } = useContext(SignerEthContext);
  return { calConfig, setCalConfig };
};
