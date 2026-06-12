"use client";

import React, { type PropsWithChildren, useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { loadPersistedContacts } from "@/state/contacts/persistence";
import { hydrateContacts } from "@/state/contacts/slice";

/**
 * ContactsGate hydrates the contacts state from localStorage before
 * rendering children. Mirrors `SettingsGate` so persistence concerns
 * stay co-located with the slice they belong to.
 */
export const ContactsGate: React.FC<PropsWithChildren> = ({ children }) => {
  const dispatch = useDispatch();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const persisted = loadPersistedContacts();
    dispatch(hydrateContacts(persisted));
    setIsHydrated(true);
  }, [dispatch]);

  if (!isHydrated) {
    return null;
  }

  return <>{children}</>;
};
