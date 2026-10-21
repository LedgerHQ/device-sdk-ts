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
  ContextModuleBuilder,
  ContextModuleChainID,
} from "@ledgerhq/context-module";
import {
  type SignerEth,
  SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";

import {
  loadAddressBook,
  subscribeToAddressBook,
  toEvmAddressBook,
} from "@/lib/contacts/addressBook";
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
  const reporterConfig = useSelector(selectReporterConfig);
  const originToken = useSelector(selectOriginToken);
  const datasourceConfig = useSelector(selectDatasourceConfig);
  // Bumped on every address-book change so the signer is rebuilt with the
  // contacts registered on the Contacts page (the snapshot is read at build).
  const [addressBookVersion, setAddressBookVersion] = useState(0);

  useEffect(
    () => subscribeToAddressBook(() => setAddressBookVersion((v) => v + 1)),
    [],
  );

  useEffect(() => {
    if (!sessionId || !dmk) {
      setSigner(null);
      return;
    }

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
      .build();
    const newSigner = new SignerEthBuilder({
      dmk,
      sessionId,
      originToken,
    })
      .withContextModule(contextModule)
      .withAddressBook(toEvmAddressBook(loadAddressBook()))
      .build();
    setSigner(newSigner);
  }, [
    calConfig,
    dmk,
    sessionId,
    web3ChecksConfig,
    metadataServiceConfig,
    reporterConfig,
    originToken,
    datasourceConfig,
    addressBookVersion,
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
