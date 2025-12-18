"use client";

import React, { type PropsWithChildren, useEffect, useState } from "react";
import { useDispatch } from "react-redux";

import { loadPersistedSettings } from "@/state/settings/persistence";
import { hydrateSettings } from "@/state/settings/slice";

/**
 * SettingsGate is a provider that hydrates the settings state from localStorage.
 * It is used to ensure that the settings state is hydrated before the app is rendered.
 *
 * If the settings state is not hydrated, the app will not be rendered.
 */
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
