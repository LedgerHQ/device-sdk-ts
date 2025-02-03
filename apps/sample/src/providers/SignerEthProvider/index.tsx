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
  type ContextModuleWeb3ChecksConfig,
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
  web3ChecksConfig: ContextModuleWeb3ChecksConfig;
  setCalConfig: (cal: ContextModuleCalConfig) => void;
  setWeb3ChecksConfig: (web3Checks: ContextModuleWeb3ChecksConfig) => void;
};

const initialState: SignerEthContextType = {
  signer: null,
  calConfig: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
  },
  web3ChecksConfig: {
    url: "https://web3checks-backend.api.aws.prd.ldg-tech.com/v3",
  },
  setCalConfig: () => {},
  setWeb3ChecksConfig: () => {},
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
  const [web3ChecksConfig, setWeb3ChecksConfig] =
    useState<ContextModuleWeb3ChecksConfig>(initialState.web3ChecksConfig);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const contextModule = new ContextModuleBuilder()
      .addCalConfig(calConfig)
      .addWeb3ChecksConfig(web3ChecksConfig)
      .build();
    const newSigner = new SignerEthBuilder({ dmk, sessionId })
      .withContextModule(contextModule)
      .build();
    setSigner(newSigner);
  }, [calConfig, dmk, sessionId, web3ChecksConfig]);

  return (
    <SignerEthContext.Provider
      value={{
        signer,
        calConfig,
        setCalConfig,
        web3ChecksConfig,
        setWeb3ChecksConfig,
      }}
    >
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

export const useWeb3ChecksConfig = () => {
  const { web3ChecksConfig, setWeb3ChecksConfig } =
    useContext(SignerEthContext);
  return { web3ChecksConfig, setWeb3ChecksConfig };
};
