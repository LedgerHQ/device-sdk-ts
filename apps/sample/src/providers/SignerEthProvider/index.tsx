"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { useSelector, useStore } from "react-redux";
import {
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  type SignerEth,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";
import {
  selectCalConfig,
  selectDatasourceConfig,
  selectMetadataServiceConfig,
  selectOriginToken,
  selectReporterConfig,
  selectWeb3ChecksConfig,
} from "@/state/settings/selectors";
import { selectContactsAutoDecorationDisabled } from "@/state/signerRuntime/selectors";
import { type AppDispatch, type RootState } from "@/state/store";

import { makeContactsDataSourceAdapter } from "./contactsDataSourceAdapter";

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
  const store = useStore<RootState, ReturnType<AppDispatch>>();
  const sessionId = useSelector(selectSelectedSessionId);

  const [signer, setSigner] = useState<SignerEth | null>(null);
  const calConfig = useSelector(selectCalConfig);
  const web3ChecksConfig = useSelector(selectWeb3ChecksConfig);
  const metadataServiceConfig = useSelector(selectMetadataServiceConfig);
  const reporterConfig = useSelector(selectReporterConfig);
  const originToken = useSelector(selectOriginToken);
  const datasourceConfig = useSelector(selectDatasourceConfig);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

    const contactsDataSource = makeContactsDataSourceAdapter({
      getWallet: () => store.getState().contacts,
      getAutoDecorationDisabled: () =>
        selectContactsAutoDecorationDisabled(store.getState()),
    });

    const contextModule = new ContextModuleBuilder({
      originToken,
      loggerFactory: (tag: string) =>
        dmk.getLoggerFactory()(["ContextModule", tag]),
    })
      .setCalConfig(calConfig)
      .setWeb3ChecksConfig(web3ChecksConfig)
      .setMetadataServiceConfig(metadataServiceConfig)
      .setReporterConfig(reporterConfig)
      .setDatasourceConfig(datasourceConfig)
      .setAppSource("device-management-kit-playground")
      .setChain(ContextModuleChainID.Ethereum)
      .setContactsDataSource(contactsDataSource)
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
    store,
    web3ChecksConfig,
    metadataServiceConfig,
    reporterConfig,
    originToken,
    datasourceConfig,
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
