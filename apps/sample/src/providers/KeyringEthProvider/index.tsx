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
  type KeyringEth,
  KeyringEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

type KeyringEthContextType = {
  keyring: KeyringEth | null;
  calConfig: ContextModuleCalConfig;
  setCalConfig: (cal: ContextModuleCalConfig) => void;
};

const initialState: KeyringEthContextType = {
  keyring: null,
  calConfig: {
    url: "https://crypto-assets-service.api.ledger.com/v1",
    mode: "prod",
    branch: "main",
  },
  setCalConfig: () => {},
};

const KeyringEthContext = createContext<KeyringEthContextType>(initialState);

export const KeyringEthProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const {
    state: { selectedId: sessionId },
  } = useDeviceSessionsContext();

  const [keyring, setKeyring] = useState<KeyringEth | null>(null);
  const [calConfig, setCalConfig] = useState<ContextModuleCalConfig>(
    initialState.calConfig,
  );

  useEffect(() => {
    if (!sessionId || !dmk) {
      setKeyring(null);
      return;
    }

    const contextModule = new ContextModuleBuilder()
      .withConfig({ cal: calConfig })
      .build();
    const newKeyring = new KeyringEthBuilder({ dmk, sessionId })
      .withContextModule(contextModule)
      .build();
    setKeyring(newKeyring);
  }, [calConfig, dmk, sessionId]);

  return (
    <KeyringEthContext.Provider value={{ keyring, calConfig, setCalConfig }}>
      {children}
    </KeyringEthContext.Provider>
  );
};

export const useKeyringEth = (): KeyringEth | null => {
  return useContext(KeyringEthContext).keyring;
};

export const useCalConfig = () => {
  const { calConfig, setCalConfig } = useContext(KeyringEthContext);
  return { calConfig, setCalConfig };
};
