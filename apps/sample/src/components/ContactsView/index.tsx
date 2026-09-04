import React, {
  createContext,
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
import { Button, Flex, Tag, Text } from "@ledgerhq/react-ui";

import { DeviceActionsList } from "@/components/DeviceActionsView/DeviceActionsList";
import { type DeviceActionProps } from "@/components/DeviceActionsView/DeviceActionTester";
import {
  ADDRESS_BOOK_STORAGE_KEY,
  type AddressBook,
  addSampleContacts,
  applyEditIdentifier,
  applyEditScope,
  applyRegister,
  applyRename,
  bytesToHex,
  type ContactGroup,
  emptyAddressBook,
  type ExternalAddress,
  externalAddressesForGroup,
  findGroupById,
  hexToBytes,
  loadAddressBook,
  saveAddressBook,
} from "@/lib/contacts/addressBook";
import { useContactsManager } from "@/providers/ContactsProvider";
import { useDmk } from "@/providers/DeviceManagementKitProvider";

// Example first-account Ethereum address (no 0x prefix).
const DEFAULT_IDENTIFIER = "de0b295669a9fd93d5f28d9ec85e40f4cb697bae";

// A distinct Ethereum address used as the default replacement for the
// edit-identifier form, so the edit visibly changes the entry's identifier.
const DEFAULT_NEW_IDENTIFIER = "70997970c51812dc3a010c7d01b50e0d17dc79c8";

// A distinct scope used as the default replacement for the edit-scope form, so
// the edit visibly changes the entry's scope.
const DEFAULT_NEW_SCOPE = "Eth cold";

function last<T>(items: T[]): T | undefined {
  return items.length > 0 ? items[items.length - 1] : undefined;
}

function truncateHex(hex: string): string {
  return hex.length > 20 ? `${hex.slice(0, 12)}…${hex.slice(-8)}` : hex;
}

/**
 * Host-side address-book store for the Contacts playground. Holds the canonical
 * {@link AddressBook} in React state, persists every change to localStorage, and
 * exposes one handler per device operation. The handlers fold a device output
 * into the book via the pure reducers in `lib/contacts/addressBook`, so a
 * successful flow updates only the proof field(s) that operation returned.
 */
type AddressBookStore = {
  book: AddressBook;
  onRegister: (output: RegisterExternalAddressOutput) => void;
  onRename: (output: RenameContactOutput) => void;
  onEditIdentifier: (output: EditExternalAddressIdentifierOutput) => void;
  onEditScope: (output: EditExternalAddressScopeOutput) => void;
  reload: () => void;
  clear: () => void;
  /** Merge the placeholder sample contacts in (idempotent). */
  loadSamples: () => void;
};

const AddressBookContext = createContext<AddressBookStore | null>(null);

function useAddressBookStore(): AddressBookStore {
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
    (output: RegisterExternalAddressOutput) =>
      setBook((prev) => applyRegister(prev, output)),
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
      reload,
      clear,
      loadSamples,
    ],
  );
}

// --- output views -----------------------------------------------------------
//
// Each view folds its device output into the address book on success (once, when
// the output arrives) and renders the returned proof material.

const SavedProofRows: React.FC<{ rows: Array<[string, string]> }> = ({
  rows,
}) => (
  <Flex flexDirection="column" rowGap={3}>
    <Flex columnGap={2} alignItems="center">
      <Tag active type="opacity">
        Saved to address book
      </Tag>
      <Text variant="small" color="neutral.c70">
        key: {ADDRESS_BOOK_STORAGE_KEY}
      </Text>
    </Flex>
    {rows.map(([label, value]) => (
      <Flex key={label} flexDirection="column">
        <Text variant="tiny" color="neutral.c70">
          {label}
        </Text>
        <Text variant="paragraph" style={{ wordBreak: "break-all" }}>
          {value}
        </Text>
      </Flex>
    ))}
  </Flex>
);

const RegisterExternalAddressOutputView: React.FC<{
  output: RegisterExternalAddressOutput;
}> = ({ output }) => {
  const { onRegister } = useAddressBookStore();
  useEffect(() => {
    onRegister(output);
  }, [output, onRegister]);

  const rows: Array<[string, string]> = [
    ["mode", output.mode],
    ["contactName", output.contactName],
    ["scope", output.scope],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    ["identifier", bytesToHex(output.identifier)],
    ["groupHandle", bytesToHex(output.groupHandle)],
    ["hmacProof", bytesToHex(output.hmacProof)],
    ["hmacRest", bytesToHex(output.hmacRest)],
  ];

  return <SavedProofRows rows={rows} />;
};

const RenameContactOutputView: React.FC<{
  output: RenameContactOutput;
}> = ({ output }) => {
  const { onRename } = useAddressBookStore();
  useEffect(() => {
    onRename(output);
  }, [output, onRename]);

  const rows: Array<[string, string]> = [
    ["previousContactName", output.previousContactName],
    ["contactName", output.contactName],
    ["groupHandle", bytesToHex(output.groupHandle)],
    ["hmacProof", bytesToHex(output.hmacProof)],
  ];

  return <SavedProofRows rows={rows} />;
};

const EditExternalAddressIdentifierOutputView: React.FC<{
  output: EditExternalAddressIdentifierOutput;
}> = ({ output }) => {
  const { onEditIdentifier } = useAddressBookStore();
  useEffect(() => {
    onEditIdentifier(output);
  }, [output, onEditIdentifier]);

  const rows: Array<[string, string]> = [
    ["contactName", output.contactName],
    ["scope", output.scope],
    ["previousIdentifier", bytesToHex(output.previousIdentifier)],
    ["identifier", bytesToHex(output.identifier)],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    ["groupHandle", bytesToHex(output.groupHandle)],
    ["hmacProof", bytesToHex(output.hmacProof)],
    ["hmacRest", bytesToHex(output.hmacRest)],
  ];

  return <SavedProofRows rows={rows} />;
};

const EditExternalAddressScopeOutputView: React.FC<{
  output: EditExternalAddressScopeOutput;
}> = ({ output }) => {
  const { onEditScope } = useAddressBookStore();
  useEffect(() => {
    onEditScope(output);
  }, [output, onEditScope]);

  const rows: Array<[string, string]> = [
    ["contactName", output.contactName],
    ["previousScope", output.previousScope],
    ["scope", output.scope],
    ["identifier", bytesToHex(output.identifier)],
    ["blockchainFamily", output.blockchainFamily],
    ["chainId", output.chainId?.toString() ?? "—"],
    ["groupHandle", bytesToHex(output.groupHandle)],
    ["hmacProof", bytesToHex(output.hmacProof)],
    ["hmacRest", bytesToHex(output.hmacRest)],
  ];

  return <SavedProofRows rows={rows} />;
};

// --- persisted address-book panel -------------------------------------------

const AddressRow: React.FC<{ address: ExternalAddress }> = ({ address }) => (
  <Flex
    flexDirection="column"
    rowGap={1}
    pl={4}
    style={{ borderLeft: "1px solid rgba(128,128,128,0.3)" }}
  >
    <Flex columnGap={2} alignItems="baseline" flexWrap="wrap">
      <Tag active type="opacity">
        {address.scope}
      </Tag>
      <Text variant="paragraph" style={{ wordBreak: "break-all" }}>
        {address.address}
      </Text>
    </Flex>
    <Text variant="tiny" color="neutral.c70">
      {address.blockchainFamily}
      {address.chainId !== undefined ? ` · chainId ${address.chainId}` : ""} ·
      hmacRest {truncateHex(bytesToHex(address.hmacRest))}
    </Text>
  </Flex>
);

const GroupCard: React.FC<{
  group: ContactGroup;
  addresses: ExternalAddress[];
}> = ({ group, addresses }) => (
  <Flex
    flexDirection="column"
    rowGap={2}
    p={3}
    style={{ border: "1px solid rgba(128,128,128,0.3)", borderRadius: 8 }}
  >
    <Text variant="large">{group.contactName}</Text>
    <Text variant="tiny" color="neutral.c70">
      groupHandle {truncateHex(bytesToHex(group.groupHandle))} · hmacProof{" "}
      {truncateHex(bytesToHex(group.hmacProof))}
    </Text>
    <Flex flexDirection="column" rowGap={2}>
      {addresses.length === 0 ? (
        <Text variant="small" color="neutral.c70">
          No external addresses in this group.
        </Text>
      ) : (
        addresses.map((address) => (
          <AddressRow key={address.id} address={address} />
        ))
      )}
    </Flex>
  </Flex>
);

const AddressBookPanel: React.FC = () => {
  const { book, reload, clear, loadSamples } = useAddressBookStore();
  // Non-empty if either collection has entries, so a partial/corrupted book
  // (addresses but no groups) still renders as populated and keeps Clear
  // enabled for recovery.
  const isEmpty =
    book.contactGroups.length === 0 && book.externalAddresses.length === 0;

  return (
    <Flex
      flexDirection="column"
      rowGap={3}
      p={4}
      mb={4}
      style={{
        border: "1px solid rgba(128,128,128,0.3)",
        borderRadius: 8,
        maxHeight: 280,
        overflowY: "auto",
      }}
    >
      <Flex
        justifyContent="space-between"
        alignItems="center"
        columnGap={3}
        flexWrap="wrap"
      >
        <Flex columnGap={2} alignItems="center">
          <Text variant="h5Inter">Address book</Text>
          <Tag active type="opacity">
            localStorage
          </Tag>
          <Text variant="small" color="neutral.c70">
            key: {ADDRESS_BOOK_STORAGE_KEY}
          </Text>
        </Flex>
        <Flex columnGap={2}>
          <Button variant="shade" size="small" onClick={loadSamples}>
            Load samples
          </Button>
          <Button variant="shade" size="small" onClick={reload}>
            Reload
          </Button>
          <Button
            variant="shade"
            size="small"
            onClick={clear}
            disabled={isEmpty}
          >
            Clear
          </Button>
        </Flex>
      </Flex>

      <Text variant="tiny" color="neutral.c70">
        “Load samples” seeds placeholder contacts for demoing the UI and
        persistence. Their proofs are fabricated — the device will reject them
        for real Rename / Edit / Provide operations.
      </Text>

      {isEmpty ? (
        <Text variant="body" color="neutral.c70">
          No contacts yet — register an external address, or load the samples,
          to populate the book.
        </Text>
      ) : (
        <Flex flexDirection="column" rowGap={3}>
          {book.contactGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              addresses={externalAddressesForGroup(book, group.id)}
            />
          ))}
        </Flex>
      )}
    </Flex>
  );
};

// --- form input types -------------------------------------------------------

type RegisterInput = {
  contactName: string;
  scope: string;
  identifier: string;
  blockchainFamily: string;
  chainId: string;
  existingGroupHandle: string;
  existingHmacProof: string;
  skipOpenApp: boolean;
};

type RenameContactInputForm = {
  previousContactName: string;
  newContactName: string;
  groupHandle: string;
  hmacProof: string;
};

type EditExternalAddressIdentifierInputForm = {
  contactName: string;
  scope: string;
  previousIdentifier: string;
  newIdentifier: string;
  blockchainFamily: string;
  chainId: string;
  groupHandle: string;
  hmacProof: string;
  hmacRest: string;
  skipOpenApp: boolean;
};

type EditExternalAddressScopeInputForm = {
  contactName: string;
  previousScope: string;
  newScope: string;
  identifier: string;
  blockchainFamily: string;
  chainId: string;
  groupHandle: string;
  hmacProof: string;
  hmacRest: string;
  skipOpenApp: boolean;
};

const ContactsViewInner: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const dmk = useDmk();
  const contactsManager = useContactsManager();
  const { book } = useAddressBookStore();

  const deviceModelId = dmk.getConnectedDevice({ sessionId }).modelId;

  // Pre-fill the rename / edit forms from the most recent persisted entries, so
  // a registered contact can be renamed or edited end-to-end. The forms capture
  // these values when a row is opened, so re-selecting a row after a successful
  // operation reflects the updated book.
  const lastGroup = last(book.contactGroups);
  const lastAddress = last(book.externalAddresses);
  const lastAddressGroup = lastAddress
    ? findGroupById(book, lastAddress.contactGroupId)
    : undefined;

  // The Contacts view lists actions with different input/output shapes, so the
  // list is typed loosely (mirroring the signer sample views).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceActions: DeviceActionProps<any, any, any, any>[] = useMemo(
    () => [
      {
        title: "Register External Address",
        description:
          "Register an external address on the device — creating a new contact group, or adding the address to an existing one by providing its group handle and name proof.",
        executeDeviceAction: ({
          contactName,
          scope,
          identifier,
          blockchainFamily,
          chainId,
          existingGroupHandle,
          existingHmacProof,
          skipOpenApp,
        }: RegisterInput) => {
          if (!contactsManager) {
            throw new Error("Contacts manager not initialized");
          }
          const existingContactGroup =
            existingGroupHandle.trim().length > 0 &&
            existingHmacProof.trim().length > 0
              ? {
                  groupHandle: hexToBytes(existingGroupHandle.trim()),
                  hmacProof: hexToBytes(existingHmacProof.trim()),
                }
              : undefined;

          return contactsManager.registerExternalAddress({
            contactName,
            scope,
            identifier: hexToBytes(identifier.trim()),
            blockchainFamily,
            chainId: chainId.trim().length > 0 ? BigInt(chainId) : undefined,
            existingContactGroup,
            skipOpenApp,
          });
        },
        validateValues: ({ contactName, scope, identifier }: RegisterInput) =>
          contactName.trim().length > 0 &&
          scope.trim().length > 0 &&
          identifier.trim().length > 0,
        initialValues: {
          contactName: "Alice",
          scope: "Eth main",
          identifier: DEFAULT_IDENTIFIER,
          blockchainFamily: "ethereum",
          chainId: "1",
          // Pre-fill the "link to existing group" fields from the latest group,
          // so adding a second address to it is one click away.
          existingGroupHandle: lastGroup
            ? bytesToHex(lastGroup.groupHandle)
            : "",
          existingHmacProof: lastGroup ? bytesToHex(lastGroup.hmacProof) : "",
          skipOpenApp: false,
        },
        OutputComponent: RegisterExternalAddressOutputView,
        deviceModelId,
      },
      {
        title: "Rename Contact",
        description:
          "Rename a contact group on the device dashboard (EDIT CONTACT NAME). Pre-filled from the most recently registered external-address contact; returns the replacement name proof.",
        executeDeviceAction: ({
          previousContactName,
          newContactName,
          groupHandle,
          hmacProof,
        }: RenameContactInputForm) => {
          if (!contactsManager) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManager.renameContact({
            previousContactName,
            newContactName,
            groupHandle: hexToBytes(groupHandle.trim()),
            hmacProof: hexToBytes(hmacProof.trim()),
          });
        },
        validateValues: ({
          previousContactName,
          newContactName,
          groupHandle,
          hmacProof,
        }: RenameContactInputForm) =>
          previousContactName.trim().length > 0 &&
          newContactName.trim().length > 0 &&
          groupHandle.trim().length > 0 &&
          hmacProof.trim().length > 0,
        initialValues: {
          previousContactName: lastGroup?.contactName ?? "Alice",
          newContactName: "Bob",
          groupHandle: lastGroup ? bytesToHex(lastGroup.groupHandle) : "",
          hmacProof: lastGroup ? bytesToHex(lastGroup.hmacProof) : "",
        },
        OutputComponent: RenameContactOutputView,
        deviceModelId,
      },
      {
        title: "Edit External Address Identifier",
        description:
          "Replace an entry's address within an existing contact group (EDIT IDENTIFIER). Pre-filled from the most recently registered external-address contact; rotates and returns the address-level proof (hmacRest) while the group name proof passes through unchanged.",
        executeDeviceAction: ({
          contactName,
          scope,
          previousIdentifier,
          newIdentifier,
          blockchainFamily,
          chainId,
          groupHandle,
          hmacProof,
          hmacRest,
          skipOpenApp,
        }: EditExternalAddressIdentifierInputForm) => {
          if (!contactsManager) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManager.editExternalAddressIdentifier({
            contactName,
            scope,
            previousIdentifier: hexToBytes(previousIdentifier.trim()),
            newIdentifier: hexToBytes(newIdentifier.trim()),
            blockchainFamily,
            chainId: chainId.trim().length > 0 ? BigInt(chainId) : undefined,
            groupHandle: hexToBytes(groupHandle.trim()),
            hmacProof: hexToBytes(hmacProof.trim()),
            hmacRest: hexToBytes(hmacRest.trim()),
            skipOpenApp,
          });
        },
        validateValues: ({
          contactName,
          scope,
          previousIdentifier,
          newIdentifier,
          groupHandle,
          hmacProof,
          hmacRest,
        }: EditExternalAddressIdentifierInputForm) =>
          contactName.trim().length > 0 &&
          scope.trim().length > 0 &&
          previousIdentifier.trim().length > 0 &&
          newIdentifier.trim().length > 0 &&
          groupHandle.trim().length > 0 &&
          hmacProof.trim().length > 0 &&
          hmacRest.trim().length > 0,
        initialValues: {
          contactName: lastAddressGroup?.contactName ?? "Alice",
          scope: lastAddress?.scope ?? "Eth main",
          previousIdentifier: lastAddress?.address ?? DEFAULT_IDENTIFIER,
          newIdentifier: DEFAULT_NEW_IDENTIFIER,
          blockchainFamily: lastAddress?.blockchainFamily ?? "ethereum",
          chainId: lastAddress?.chainId?.toString() ?? "1",
          groupHandle: lastAddress ? bytesToHex(lastAddress.groupHandle) : "",
          hmacProof: lastAddressGroup
            ? bytesToHex(lastAddressGroup.hmacProof)
            : "",
          hmacRest: lastAddress ? bytesToHex(lastAddress.hmacRest) : "",
          skipOpenApp: false,
        },
        OutputComponent: EditExternalAddressIdentifierOutputView,
        deviceModelId,
      },
      {
        title: "Edit External Address Scope",
        description:
          "Replace an entry's scope within an existing contact group (EDIT SCOPE), keeping the same contact name and identifier. Pre-filled from the most recently registered external-address contact; rotates and returns the address-level proof (hmacRest) while the group name proof passes through unchanged.",
        executeDeviceAction: ({
          contactName,
          previousScope,
          newScope,
          identifier,
          blockchainFamily,
          chainId,
          groupHandle,
          hmacProof,
          hmacRest,
          skipOpenApp,
        }: EditExternalAddressScopeInputForm) => {
          if (!contactsManager) {
            throw new Error("Contacts manager not initialized");
          }

          return contactsManager.editExternalAddressScope({
            contactName,
            previousScope,
            newScope,
            identifier: hexToBytes(identifier.trim()),
            blockchainFamily,
            chainId: chainId.trim().length > 0 ? BigInt(chainId) : undefined,
            groupHandle: hexToBytes(groupHandle.trim()),
            hmacProof: hexToBytes(hmacProof.trim()),
            hmacRest: hexToBytes(hmacRest.trim()),
            skipOpenApp,
          });
        },
        validateValues: ({
          contactName,
          previousScope,
          newScope,
          identifier,
          groupHandle,
          hmacProof,
          hmacRest,
        }: EditExternalAddressScopeInputForm) =>
          contactName.trim().length > 0 &&
          previousScope.trim().length > 0 &&
          newScope.trim().length > 0 &&
          identifier.trim().length > 0 &&
          groupHandle.trim().length > 0 &&
          hmacProof.trim().length > 0 &&
          hmacRest.trim().length > 0,
        initialValues: {
          contactName: lastAddressGroup?.contactName ?? "Alice",
          previousScope: lastAddress?.scope ?? "Eth main",
          newScope: DEFAULT_NEW_SCOPE,
          identifier: lastAddress?.address ?? DEFAULT_IDENTIFIER,
          blockchainFamily: lastAddress?.blockchainFamily ?? "ethereum",
          chainId: lastAddress?.chainId?.toString() ?? "1",
          groupHandle: lastAddress ? bytesToHex(lastAddress.groupHandle) : "",
          hmacProof: lastAddressGroup
            ? bytesToHex(lastAddressGroup.hmacProof)
            : "",
          hmacRest: lastAddress ? bytesToHex(lastAddress.hmacRest) : "",
          skipOpenApp: false,
        },
        OutputComponent: EditExternalAddressScopeOutputView,
        deviceModelId,
      },
    ],
    [contactsManager, deviceModelId, lastGroup, lastAddress, lastAddressGroup],
  );

  return (
    <Flex flexDirection="column" flex={1} overflow="hidden">
      <AddressBookPanel />
      <Flex flex={1} overflow="hidden">
        <DeviceActionsList title="Contacts" deviceActions={deviceActions} />
      </Flex>
    </Flex>
  );
};

export const ContactsView: React.FC<{ sessionId: string }> = ({
  sessionId,
}) => {
  const store = useAddressBookState();
  return (
    <AddressBookContext.Provider value={store}>
      <ContactsViewInner sessionId={sessionId} />
    </AddressBookContext.Provider>
  );
};
