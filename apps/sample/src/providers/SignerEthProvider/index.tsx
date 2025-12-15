"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { ContextModuleBuilder } from "@ledgerhq/context-module";
import {
  type SignerEth,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useSelectedSessionId } from "@/state/sessions/hooks";
import {
  useCalConfig,
  useMetadataServiceConfig,
  useOriginToken,
  useWeb3ChecksConfig,
} from "@/state/settings/hooks";

type SignerEthContextType = {
  signer: SignerEth | null;
};

const initialState: SignerEthContextType = {
  signer: null,
};

const SignerEthContext = createContext<SignerEthContextType>(initialState);

export const SignerEthProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelectedSessionId();

  const [signer, setSigner] = useState<SignerEth | null>(null);
  const { calConfig } = useCalConfig();
  const { web3ChecksConfig } = useWeb3ChecksConfig();
  const { metadataServiceDomain } = useMetadataServiceConfig();
  const { originToken } = useOriginToken();

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
      }}
    >
      {children}
    </SignerEthContext.Provider>
  );
};

export const useSignerEth = (): SignerEth | null => {
  return useContext(SignerEthContext).signer;
};
