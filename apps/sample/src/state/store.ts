import { combineReducers, configureStore } from "@reduxjs/toolkit";

import { sessionsReducer, sessionsSlice } from "./sessions/slice";
import { settingsPersistenceMiddleware } from "./settings/persistenceMiddleware";
import { settingsReducer, settingsSlice } from "./settings/slice";
import { uiReducer, uiSlice } from "./ui/slice";

const reducer = combineReducers({
  [sessionsSlice.reducerPath]: sessionsReducer,
  [settingsSlice.reducerPath]: settingsReducer,
  [uiSlice.reducerPath]: uiReducer,
});

export type RootState = ReturnType<typeof reducer>;

export const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["sessions/addSession"],
        ignoredPaths: ["sessions.connectedDevices"],
      },
    }).concat(settingsPersistenceMiddleware),
  devTools: true,
});

export type AppDispatch = typeof store.dispatch;

export const storeInitialState: RootState = reducer(undefined, {
  type: "@@INIT",
});
