import React, {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type EditExternalAddressIdentifierOutput,
  type EditExternalAddressScopeOutput,
  type RegisterExternalAddressOutput,
  type RenameContactOutput,
} from "@ledgerhq/device-contacts-kit";

import {
  addLocalContact,
  type AddressBook,
  addSampleContacts,
  applyEditIdentifier,
  applyEditScope,
  applyRegister,
  applyRename,
  deleteContact,
  deleteExternalAddress,
  emptyAddressBook,
  loadAddressBook,
  newId,
  renameLocalContact,
  saveAddressBook,
} from "@/lib/contacts/addressBook";

/**
 * Host-side address-book store for the Contacts playground. Holds the canonical
 * {@link AddressBook} in React state, persists every change to localStorage, and
 * exposes one handler per device operation plus the local-only edits. Device
 * outputs are folded in via the pure reducers in `lib/contacts/addressBook`, so
 * a successful flow updates only the proof field(s) that operation returned.
 */
export type AddressBookStore = {
  book: AddressBook;
  /** `localGroupId` names the local-only contact the address was added to. */
  onRegister: (
    output: RegisterExternalAddressOutput,
    localGroupId?: string,
  ) => void;
  onRename: (output: RenameContactOutput) => void;
  onEditIdentifier: (output: EditExternalAddressIdentifierOutput) => void;
  onEditScope: (output: EditExternalAddressScopeOutput) => void;
  /** Add a local-only contact; returns its id. */
  addContact: (contactName: string) => string;
  renameLocal: (groupId: string, contactName: string) => void;
  removeContact: (groupId: string) => void;
  removeAddress: (addressId: string) => void;
  reload: () => void;
  clear: () => void;
  /** Merge the placeholder sample contacts in (idempotent). */
  loadSamples: () => void;
};

const AddressBookContext = createContext<AddressBookStore | null>(null);

export function useAddressBookStore(): AddressBookStore {
  const ctx = useContext(AddressBookContext);
  if (!ctx) {
    throw new Error("useAddressBookStore must be used within its provider");
  }
  return ctx;
}

function useAddressBookState(): AddressBookStore {
  const [book, setBook] = useState<AddressBook>(emptyAddressBook);
  // Gate persistence until after the client-side hydration load, so the initial
  // empty state never clobbers an existing book on disk.
  const [hydrated, setHydrated] = useState(false);

  // Reload from localStorage on mount (client only — avoids an SSR/CSR
  // hydration mismatch, since the server has no localStorage).
  useEffect(() => {
    setBook(loadAddressBook());
    setHydrated(true);
  }, []);

  // Single writer: persist whenever the book changes (post-hydration). Keeping
  // this out of the state updaters makes those updaters pure — important under
  // React StrictMode, which double-invokes them.
  useEffect(() => {
    if (hydrated) saveAddressBook(book);
  }, [book, hydrated]);

  // Handlers are stable (empty deps + functional updates), so the output views
  // that fold a device result in via `useEffect([output, handler])` fire once
  // per operation instead of re-running every time the book changes.
  const onRegister = useCallback(
    (output: RegisterExternalAddressOutput, localGroupId?: string) =>
      setBook((prev) => applyRegister(prev, output, localGroupId)),
    [],
  );
  const onRename = useCallback(
    (output: RenameContactOutput) =>
      setBook((prev) => applyRename(prev, output)),
    [],
  );
  const onEditIdentifier = useCallback(
    (output: EditExternalAddressIdentifierOutput) =>
      setBook((prev) => applyEditIdentifier(prev, output)),
    [],
  );
  const onEditScope = useCallback(
    (output: EditExternalAddressScopeOutput) =>
      setBook((prev) => applyEditScope(prev, output)),
    [],
  );
  const addContact = useCallback((contactName: string) => {
    // The id is drawn outside the updater so a StrictMode double-invoke adds
    // the same contact twice over the same state, not two contacts.
    const id = newId();
    setBook((prev) => addLocalContact(prev, { id, contactName }));
    return id;
  }, []);
  const renameLocal = useCallback(
    (groupId: string, contactName: string) =>
      setBook((prev) => renameLocalContact(prev, groupId, contactName)),
    [],
  );
  const removeContact = useCallback(
    (groupId: string) => setBook((prev) => deleteContact(prev, groupId)),
    [],
  );
  const removeAddress = useCallback(
    (addressId: string) =>
      setBook((prev) => deleteExternalAddress(prev, addressId)),
    [],
  );
  const reload = useCallback(() => setBook(loadAddressBook()), []);
  const clear = useCallback(() => setBook(emptyAddressBook()), []);
  const loadSamples = useCallback(
    () => setBook((prev) => addSampleContacts(prev)),
    [],
  );

  return useMemo<AddressBookStore>(
    () => ({
      book,
      onRegister,
      onRename,
      onEditIdentifier,
      onEditScope,
      addContact,
      renameLocal,
      removeContact,
      removeAddress,
      reload,
      clear,
      loadSamples,
    }),
    [
      book,
      onRegister,
      onRename,
      onEditIdentifier,
      onEditScope,
      addContact,
      renameLocal,
      removeContact,
      removeAddress,
      reload,
      clear,
      loadSamples,
    ],
  );
}

export const AddressBookProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const store = useAddressBookState();
  return (
    <AddressBookContext.Provider value={store}>
      {children}
    </AddressBookContext.Provider>
  );
};
