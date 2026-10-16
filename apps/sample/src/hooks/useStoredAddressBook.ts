import { useEffect, useState } from "react";

import {
  type AddressBook,
  emptyAddressBook,
  loadAddressBook,
  subscribeToAddressBook,
} from "@/lib/contacts/addressBook";

/**
 * The address book saved by the Contacts page, kept current: a new book is
 * returned whenever it changes, in this tab or another. Signers built from it
 * (`withAddressBook`) are rebuilt with the latest contacts.
 */
export function useStoredAddressBook(): AddressBook {
  // Loaded after mount: the server has no localStorage.
  const [book, setBook] = useState<AddressBook>(emptyAddressBook);
  useEffect(() => {
    setBook(loadAddressBook());
    return subscribeToAddressBook(() => setBook(loadAddressBook()));
  }, []);
  return book;
}
