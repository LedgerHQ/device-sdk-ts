import { type Middleware } from "@reduxjs/toolkit";

import { saveSettings } from "./persistence";
import { type SettingsState } from "./schema";
import { settingsSlice } from "./slice";

type StateWithSettings = {
  settings: SettingsState;
};

export const settingsPersistenceMiddleware: Middleware<
  object,
  StateWithSettings
> = (store) => (next) => (action) => {
  const result = next(action);

  // Only save when a settings action is dispatched (excluding hydrate)
  if (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    typeof action.type === "string" &&
    action.type.startsWith(settingsSlice.name + "/") &&
    action.type !== `${settingsSlice.name}/hydrateSettings`
  ) {
    const state = store.getState();
    saveSettings(state.settings);
  }

  return result;
};
