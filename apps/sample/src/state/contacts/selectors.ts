import { type RootState } from "@/state/store";

export const selectWallet = (state: RootState) => state.contacts;
export const selectContacts = (state: RootState) => state.contacts.contacts;
export const selectAccounts = (state: RootState) => state.contacts.accounts;
export const selectContactsCount = (state: RootState) =>
  Object.keys(state.contacts.contacts).length;
export const selectAccountsCount = (state: RootState) =>
  Object.keys(state.contacts.accounts).length;
