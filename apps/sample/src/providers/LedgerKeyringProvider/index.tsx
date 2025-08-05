"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type LedgerKeyringProtocol,
  LedgerKeyringProtocolBuilder,
} from "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

type LedgerKeyringProtocolContextType = {
  app: LedgerKeyringProtocol | null;
};

const initialState: LedgerKeyringProtocolContextType = {
  app: null,
};

const LedgerKeyringProtocolContext =
  createContext<LedgerKeyringProtocolContextType>(initialState);

export const LedgerKeyringProtocolProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const {
    state: { selectedId: sessionId },
  } = useDeviceSessionsContext();

  const [app, setApp] = useState<LedgerKeyringProtocol | null>(null);
  useEffect(() => {
    if (!sessionId || !dmk) {
      setApp(null);
      return;
    }
    const newApp = new LedgerKeyringProtocolBuilder({
      dmk,
      sessionId,
      baseUrl:
        process.env.TRUSTCHAIN_BACKEND_URL ||
        "https://trustchain-backend.api.aws.stg.ldg-tech.com/v1",
    }).build();

    setApp(newApp);
  }, [dmk, sessionId]);

  return (
    <LedgerKeyringProtocolContext.Provider
      value={{
        app,
      }}
    >
      {children}
    </LedgerKeyringProtocolContext.Provider>
  );
};

export const useLedgerKeyringProtocol = (): LedgerKeyringProtocol | null => {
  return useContext(LedgerKeyringProtocolContext).app;
};
