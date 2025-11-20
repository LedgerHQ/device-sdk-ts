"use client";

import React, {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type LedgerKeyRingProtocol,
  LedgerKeyRingProtocolBuilder,
  LKRPEnv,
} from "@ledgerhq/device-trusted-app-kit-ledger-keyring-protocol";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { useDeviceSessionsContext } from "@/providers/DeviceSessionsProvider";

type LedgerKeyRingProtocolContextType = {
  app: LedgerKeyRingProtocol | null;
};

const LEDGER_SYNC_APPID = 16;

const initialState: LedgerKeyRingProtocolContextType = {
  app: null,
};

const LedgerKeyRingProtocolContext =
  createContext<LedgerKeyRingProtocolContextType>(initialState);

export const LedgerKeyRingProtocolProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const {
    state: { selectedId: sessionId },
  } = useDeviceSessionsContext();

  const [app, setApp] = useState<LedgerKeyRingProtocol | null>(null);
  useEffect(() => {
    if (!dmk) {
      setApp(null);
      return;
    }
    const newApp = new LedgerKeyRingProtocolBuilder({
      dmk,
      applicationId: LEDGER_SYNC_APPID,
      env: LKRPEnv.STAGING,
    }).build();

    setApp(newApp);
  }, [dmk, sessionId]);

  return (
    <LedgerKeyRingProtocolContext.Provider
      value={{
        app,
      }}
    >
      {children}
    </LedgerKeyRingProtocolContext.Provider>
  );
};

export const useLedgerKeyRingProtocol = (): LedgerKeyRingProtocol | null => {
  return useContext(LedgerKeyRingProtocolContext).app;
};
