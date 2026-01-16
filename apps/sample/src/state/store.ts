import { combineReducers, configureStore } from "@reduxjs/toolkit";

import { sessionsReducer, sessionsSlice } from "./sessions/slice";
import { settingsPersistenceMiddleware } from "./settings/persistenceMiddleware";
import { settingsReducer, settingsSlice } from "./settings/slice";

const reducer = combineReducers({
  [sessionsSlice.reducerPath]: sessionsReducer,
  [settingsSlice.reducerPath]: settingsReducer,
});

export type RootState = ReturnType<typeof reducer>;

export const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(settingsPersistenceMiddleware),
  devTools: true,
});

export type AppDispatch = typeof store.dispatch;

export const storeInitialState: RootState = reducer(undefined, {
  type: "@@INIT",
});
