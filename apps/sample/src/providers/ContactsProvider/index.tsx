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

import {
  CONTACTS_APP_BY_FAMILY,
  type ContactsFamily,
} from "@/lib/contacts/addressBook";
import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

/**
 * One manager per blockchain family: app-owned Contacts operations must run in
 * the embedded app that serves the family (Ethereum, Tron). Rename is a
 * dashboard operation, so any of them serves it.
 */
type ContactsManagers = Readonly<Record<ContactsFamily, ContactsManager>>;

type ContactsContextType = {
  contactsManagers: ContactsManagers | null;
};

const initialState: ContactsContextType = {
  contactsManagers: null,
};

const ContactsContext = createContext<ContactsContextType>(initialState);

export const ContactsProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [contactsManagers, setContactsManagers] =
    useState<ContactsManagers | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setContactsManagers(null);
      return;
    }

    const build = (appName: string) =>
      new ContactsManagerBuilder({ dmk, sessionId, appName }).build();

    setContactsManagers({
      ethereum: build(CONTACTS_APP_BY_FAMILY.ethereum),
      tron: build(CONTACTS_APP_BY_FAMILY.tron),
    });
  }, [dmk, sessionId]);

  return (
    <ContactsContext.Provider value={{ contactsManagers }}>
      {children}
    </ContactsContext.Provider>
  );
};

export const useContactsManagers = (): ContactsManagers | null => {
  return useContext(ContactsContext).contactsManagers;
};
