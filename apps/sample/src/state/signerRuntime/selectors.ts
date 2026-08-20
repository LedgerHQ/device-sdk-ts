import { type RootState } from "@/state/store";

export const selectContactsAutoDecorationDisabled = (state: RootState) =>
  state.signerRuntime.contactsAutoDecorationDisabled;
