import { configureStore } from "@reduxjs/toolkit";

import { sessionsReducer, sessionsSlice } from "./sessions/slice";

export const store = configureStore({
  reducer: {
    [sessionsSlice.reducerPath]: sessionsReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware(),
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
