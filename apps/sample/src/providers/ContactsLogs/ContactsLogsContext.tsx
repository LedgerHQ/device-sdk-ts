"use client";
import React, {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { LogLevel } from "@ledgerhq/device-management-kit";

import {
  type ContactsLogEntry,
  type ContactsLogsLogger,
} from "./ContactsLogsLogger";

export type { ContactsLogEntry } from "./ContactsLogsLogger";

type ContactsLogsContextValue = {
  readonly logger: ContactsLogsLogger;
};

const ContactsLogsContext = createContext<ContactsLogsContextValue | null>(
  null,
);

export const ContactsLogsProvider: React.FC<
  PropsWithChildren<{ logger: ContactsLogsLogger }>
> = ({ logger, children }) => {
  const value = useMemo(() => ({ logger }), [logger]);
  return (
    <ContactsLogsContext.Provider value={value}>
      {children}
    </ContactsLogsContext.Provider>
  );
};

function useContactsLogsCtx(): ContactsLogsContextValue {
  const ctx = useContext(ContactsLogsContext);
  if (!ctx) {
    throw new Error(
      "useContactsLogs must be used within a ContactsLogsProvider",
    );
  }
  return ctx;
}

export function useContactsLogEntries(): readonly ContactsLogEntry[] {
  const { logger } = useContactsLogsCtx();
  return useSyncExternalStore(
    logger.subscribe,
    logger.snapshot,
    logger.snapshot,
  );
}

export function useContactsLogsController() {
  const { logger } = useContactsLogsCtx();
  return useMemo(
    () => ({
      clear: () => logger.clear(),
      setPaused: (paused: boolean) => logger.setPaused(paused),
      isPaused: () => logger.isPaused(),
    }),
    [logger],
  );
}

// Hook for forms to push a "user submitted X with input Y" entry into the
// panel. Tagged `contacts-form` so it lands in the Form filter chip.
export function useContactsFormLogger() {
  const { logger } = useContactsLogsCtx();
  return useCallback(
    (formName: string, input: Record<string, unknown>) => {
      logger.record(LogLevel.Info, `[form] ${formName} submitted`, {
        tag: "contacts-form",
        timestamp: Date.now(),
        data: { form: formName, input },
      });
    },
    [logger],
  );
}
