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

const LedgerKeyringProtocol =
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
    }).build();

    setApp(newApp);
  }, [dmk, sessionId]);

  return (
    <LedgerKeyringProtocol.Provider
      value={{
        app,
      }}
    >
      {children}
    </LedgerKeyringProtocol.Provider>
  );
};

export const useLedgerKeyringProtocol = (): unknown | null => {
  return useContext(LedgerKeyringProtocol).app;
};
