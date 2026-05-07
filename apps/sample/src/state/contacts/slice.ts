import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { type ContactsState, initialState } from "./schema";

export const contactsSlice = createSlice({
  name: "contacts",
  reducerPath: "contacts",
  initialState,
  reducers: {
    setWallet: (_state, action: PayloadAction<ContactsState>) => action.payload,
    resetWallet: () => initialState,
    hydrateContacts: (_state, action: PayloadAction<ContactsState>) =>
      action.payload,
  },
});

export const { setWallet, resetWallet, hydrateContacts } =
  contactsSlice.actions;

export const contactsReducer = contactsSlice.reducer;
