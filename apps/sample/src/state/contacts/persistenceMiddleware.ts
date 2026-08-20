import { type Middleware } from "@reduxjs/toolkit";

import { clearPersistedContacts, saveContacts } from "./persistence";
import { type ContactsState } from "./schema";
import { contactsSlice } from "./slice";

type StateWithContacts = {
  contacts: ContactsState;
};

const HYDRATE_ACTION = `${contactsSlice.name}/hydrateContacts`;
const RESET_ACTION = `${contactsSlice.name}/resetWallet`;

export const contactsPersistenceMiddleware: Middleware<
  object,
  StateWithContacts
> = (store) => (next) => (action) => {
  const result = next(action);

  if (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    typeof action.type === "string" &&
    action.type.startsWith(contactsSlice.name + "/") &&
    action.type !== HYDRATE_ACTION
  ) {
    if (action.type === RESET_ACTION) {
      // Reset wipes the localStorage key entirely so the smoke runbook
      // step 12 invariant ("key gone after reset") holds.
      clearPersistedContacts();
    } else {
      const state = store.getState();
      saveContacts(state.contacts);
    }
  }

  return result;
};
