"use client";

import React, { type PropsWithChildren, useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { loadPersistedSettings } from "@/state/settings/persistence";
import { hydrateSettings } from "@/state/settings/slice";

export const SettingsGate: React.FC<PropsWithChildren> = ({ children }) => {
  const dispatch = useDispatch();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const persistedSettings = loadPersistedSettings();
    dispatch(hydrateSettings(persistedSettings));
    setIsHydrated(true);
  }, [dispatch]);

  if (!isHydrated) {
    return null;
  }

  return <>{children}</>;
};
