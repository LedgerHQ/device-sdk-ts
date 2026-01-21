"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSelector } from "react-redux";
import { ContextModuleBuilder } from "@ledgerhq/context-module";
import {
  type SignerEth,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";
import {
  selectCalConfig,
  selectMetadataServiceConfig,
  selectOriginToken,
  selectWeb3ChecksConfig,
} from "@/state/settings/selectors";

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
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerEth | null>(null);
  const calConfig = useSelector(selectCalConfig);
  const web3ChecksConfig = useSelector(selectWeb3ChecksConfig);
  const metadataServiceConfig = useSelector(selectMetadataServiceConfig);
  const originToken = useSelector(selectOriginToken);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const contextModule = new ContextModuleBuilder({
      originToken,
      loggerFactory: (tag: string) =>
        dmk.getLoggerFactory()(`ContextModule-${tag}`),
    })
      .setCalConfig(calConfig)
      .setWeb3ChecksConfig(web3ChecksConfig)
      .setMetadataServiceConfig(metadataServiceConfig)
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
    metadataServiceConfig,
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
