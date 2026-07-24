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
  type ContactsService,
  ContactsServiceBuilder,
} from "@ledgerhq/device-management-kit";

import { useDmk } from "@/providers/DeviceManagementKitProvider";
import { selectSelectedSessionId } from "@/state/sessions/selectors";

type ContactsServiceContextType = {
  service: ContactsService | null;
};

const initialState: ContactsServiceContextType = {
  service: null,
};

const ContactsServiceContext =
  createContext<ContactsServiceContextType>(initialState);

export const ContactsServiceProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const dmk = useDmk();
  const sessionId = useSelector(selectSelectedSessionId);

  const [service, setService] = useState<ContactsService | null>(null);

  useEffect(() => {
    if (!sessionId || !dmk) {
      setService(null);
      return;
    }
    setService(new ContactsServiceBuilder({ dmk, sessionId }).build());
  }, [dmk, sessionId]);

  return (
    <ContactsServiceContext.Provider value={{ service }}>
      {children}
    </ContactsServiceContext.Provider>
  );
};

export const useContactsService = (): ContactsService | null => {
  return useContext(ContactsServiceContext).service;
};
