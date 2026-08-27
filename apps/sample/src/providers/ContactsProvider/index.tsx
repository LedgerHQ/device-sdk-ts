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
  type ContactsManager,
  ContactsManagerBuilder,
} from "@ledgerhq/device-contacts-kit";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

// Contacts v1 is served by the Ethereum embedded app.
const CONTACTS_APP_NAME = "Ethereum";

type ContactsContextType = {
  contactsManager: ContactsManager | null;
};

const initialState: ContactsContextType = {
  contactsManager: null,
};

const ContactsContext = createContext<ContactsContextType>(initialState);

export const ContactsProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [contactsManager, setContactsManager] =
    useState<ContactsManager | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setContactsManager(null);
      return;
    }

    setContactsManager(
      new ContactsManagerBuilder({
        dmk,
        sessionId,
        appName: CONTACTS_APP_NAME,
      }).build(),
    );
  }, [dmk, sessionId]);

  return (
    <ContactsContext.Provider value={{ contactsManager }}>
      {children}
    </ContactsContext.Provider>
  );
};

export const useContactsManager = (): ContactsManager | null => {
  return useContext(ContactsContext).contactsManager;
};
