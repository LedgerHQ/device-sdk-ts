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
  type ContextModuleTransactionCheckConfig,
} from "@ledgerhq/context-module";
import { type ContextModuleMetadataServiceConfig } from "@ledgerhq/context-module";
import {
  type SignerEth,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

type SignerEthContextType = {
  signer: SignerEth | null;
  calConfig: ContextModuleCalConfig;
  transactionCheckConfig: ContextModuleTransactionCheckConfig;
  setCalConfig: (cal: ContextModuleCalConfig) => void;
  setTransactionCheckConfig: (
    transactionCheck: ContextModuleTransactionCheckConfig,
  ) => void;
  metadataServiceDomain: ContextModuleMetadataServiceConfig;
  setMetadataServiceConfig: (
    metadataService: ContextModuleMetadataServiceConfig,
  ) => void;
};

const initialState: SignerEthContextType = {
  signer: null,
  calConfig: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
  },
  transactionCheckConfig: {
    url: "https://web3checks-backend.api.ledger.com/v3",
  },
  metadataServiceDomain: {
    url: "https://nft.api.live.ledger.com",
  },
  setCalConfig: () => {},
  setTransactionCheckConfig: () => {},
  setMetadataServiceConfig: () => {},
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
  const [transactionCheckConfig, setTransactionCheckConfig] =
    useState<ContextModuleTransactionCheckConfig>(
      initialState.transactionCheckConfig,
    );
  const [metadataServiceDomain, setMetadataServiceConfig] =
    useState<ContextModuleMetadataServiceConfig>(
      initialState.metadataServiceDomain,
    );

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const contextModule = new ContextModuleBuilder({
      originToken:
        "1e55ba3959f4543af24809d9066a2120bd2ac9246e626e26a1ff77eb109ca0e5", // TODO: replace with your origin token
    })
      .setCalConfig(calConfig)
      .setTransactionCheckConfig(transactionCheckConfig)
      .setMetadataServiceConfig(metadataServiceDomain)
      .build();
    const newSigner = new SignerEthBuilder({
      dmk,
      sessionId,
      originToken:
        "1e55ba3959f4543af24809d9066a2120bd2ac9246e626e26a1ff77eb109ca0e5",
    })
      .withContextModule(contextModule)
      .build();
    setSigner(newSigner);
  }, [
    calConfig,
    dmk,
    sessionId,
    transactionCheckConfig,
    metadataServiceDomain,
  ]);

  return (
    <SignerEthContext.Provider
      value={{
        signer,
        calConfig,
        setCalConfig,
        transactionCheckConfig,
        setTransactionCheckConfig,
        metadataServiceDomain,
        setMetadataServiceConfig,
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

export const useTransactionCheckConfig = () => {
  const { transactionCheckConfig, setTransactionCheckConfig } =
    useContext(SignerEthContext);
  return { transactionCheckConfig, setTransactionCheckConfig };
};

export const useMetadataServiceConfig = () => {
  const { metadataServiceDomain, setMetadataServiceConfig } =
    useContext(SignerEthContext);
  return { metadataServiceDomain, setMetadataServiceConfig };
};
