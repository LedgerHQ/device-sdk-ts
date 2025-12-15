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
import { type ContextModuleMetadataServiceConfig } from "@ledgerhq/context-module";
import {
  type SignerEth,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSelectedSessionId } from "@/state/sessions/hooks";

type SignerEthContextType = {
  signer: SignerEth | null;
  calConfig: ContextModuleCalConfig;
  web3ChecksConfig: ContextModuleWeb3ChecksConfig;
  setCalConfig: (cal: ContextModuleCalConfig) => void;
  setWeb3ChecksConfig: (web3Checks: ContextModuleWeb3ChecksConfig) => void;
  metadataServiceDomain: ContextModuleMetadataServiceConfig;
  setMetadataServiceConfig: (
    metadataService: ContextModuleMetadataServiceConfig,
  ) => void;
  originToken: string;
  setOriginToken: (token: string) => void;
};

const initialState: SignerEthContextType = {
  signer: null,
  calConfig: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
  },
  web3ChecksConfig: {
    url: "https://web3checks-backend.api.ledger.com/v3",
  },
  metadataServiceDomain: {
    url: "https://nft.api.live.ledger.com",
  },
  originToken: process.env.NEXT_PUBLIC_GATING_TOKEN || "origin-token",
  setCalConfig: () => {},
  setWeb3ChecksConfig: () => {},
  setMetadataServiceConfig: () => {},
  setOriginToken: () => {},
};

const SignerEthContext = createContext<SignerEthContextType>(initialState);

export const SignerEthProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelectedSessionId();

  const [signer, setSigner] = useState<SignerEth | null>(null);
  const [calConfig, setCalConfig] = useState<ContextModuleCalConfig>(
    initialState.calConfig,
  );
  const [web3ChecksConfig, setWeb3ChecksConfig] =
    useState<ContextModuleWeb3ChecksConfig>(initialState.web3ChecksConfig);
  const [metadataServiceDomain, setMetadataServiceConfig] =
    useState<ContextModuleMetadataServiceConfig>(
      initialState.metadataServiceDomain,
    );
  const [originToken, setOriginToken] = useState<string>(
    initialState.originToken,
  );

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const contextModule = new ContextModuleBuilder({
      originToken,
    })
      .setCalConfig(calConfig)
      .setWeb3ChecksConfig(web3ChecksConfig)
      .setMetadataServiceConfig(metadataServiceDomain)
      .build();
    const newSigner = new SignerEthBuilder({
      dmk,
      sessionId,
      originToken,
    })
      .withContextModule(contextModule)
      .build();
    setSigner(newSigner);
  }, [
    calConfig,
    dmk,
    sessionId,
    web3ChecksConfig,
    metadataServiceDomain,
    originToken,
  ]);

  return (
    <SignerEthContext.Provider
      value={{
        signer,
        calConfig,
        setCalConfig,
        web3ChecksConfig,
        setWeb3ChecksConfig,
        metadataServiceDomain,
        setMetadataServiceConfig,
        originToken,
        setOriginToken,
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

export const useMetadataServiceConfig = () => {
  const { metadataServiceDomain, setMetadataServiceConfig } =
    useContext(SignerEthContext);
  return { metadataServiceDomain, setMetadataServiceConfig };
};

export const useOriginToken = () => {
  const { originToken, setOriginToken } = useContext(SignerEthContext);
  return { originToken, setOriginToken };
};
