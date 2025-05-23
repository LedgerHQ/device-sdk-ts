"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type TrustedAppLedgerSync,
  TrustedAppLedgerSyncBuilder,
} from "@ledgerhq/device-trusted-app-kit-ledger-sync";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

type LedgerSyncContextType = {
  app: TrustedAppLedgerSync | null;
};

const initialState: LedgerSyncContextType = {
  app: null,
};

const LedgerSync = createContext<LedgerSyncContextType>(initialState);

export const LedgerSyncProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const {
    state: { selectedId: sessionId },
  } = useDeviceSessionsContext();

  const [app, setApp] = useState<TrustedAppLedgerSync | null>(null);
  useEffect(() => {
    if (!sessionId || !dmk) {
      setApp(null);
      return;
    }
    const newApp = new TrustedAppLedgerSyncBuilder({
      dmk,
      sessionId,
    }).build();

    // new SignerEthBuilder({
    //   dmk,
    //   sessionId,
    // })
    //   .withContextModule(contextModule)
    //   .build();

    setApp(newApp);
  }, [dmk, sessionId]);

  return (
    <LedgerSync.Provider
      value={{
        app,
      }}
    >
      {children}
    </LedgerSync.Provider>
  );
};

export const useLedgerSync = (): unknown | null => {
  return useContext(LedgerSync).app;
};
