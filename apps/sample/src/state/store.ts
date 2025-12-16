import { combineReducers, configureStore } from "@reduxjs/toolkit";

import { sessionsReducer, sessionsSlice } from "./sessions/slice";
import { settingsReducer, settingsSlice } from "./settings/slice";

const reducer = combineReducers({
  [sessionsSlice.reducerPath]: sessionsReducer,
  [settingsSlice.reducerPath]: settingsReducer,
});

export const store = configureStore({
  reducer,
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const storeInitialState: RootState = reducer(undefined, {
  type: "@@INIT",
});
