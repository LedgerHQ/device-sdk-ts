import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  NavBar,
  NavBarTitle,
  NavBarTrailing,
} from "@ledgerhq/lumen-ui-react";
import { Code, UserAdd } from "@ledgerhq/lumen-ui-react/symbols";
import { useRouter } from "next/navigation";

import { useAddressBookStore } from "@/components/ContactsView/AddressBookStore";
import { ContactDetail } from "@/components/ContactsView/ContactDetail";
import { ContactsList } from "@/components/ContactsView/ContactsList";
import {
  type ContactsDeviceOperation,
  editAddressOperation,
  registerAddressOperation,
  renameContactOperation,
} from "@/components/ContactsView/deviceOperations";
import { DeviceStepDialog } from "@/components/ContactsView/DeviceStepDialog";
import { AddAddressDialog } from "@/components/ContactsView/dialogs/AddAddressDialog";
import { AddressDetailDialog } from "@/components/ContactsView/dialogs/AddressDetailDialog";
import { ConfirmDeleteDialog } from "@/components/ContactsView/dialogs/ConfirmDeleteDialog";
import { ContactNameDialog } from "@/components/ContactsView/dialogs/ContactNameDialog";
import { EditAddressDialog } from "@/components/ContactsView/dialogs/EditAddressDialog";
import {
  externalAddressesForGroup,
  findGroupById,
  isRegisteredGroup,
} from "@/lib/contacts/addressBook";
import { isContactsFamily } from "@/lib/contacts/families";

type DialogState =
  | { type: "add-contact" }
  | { type: "edit-contact"; groupId: string }
  | { type: "delete-contact"; groupId: string }
  | { type: "add-address"; groupId: string }
  | { type: "address-detail"; addressId: string }
  | { type: "edit-address"; addressId: string }
  | { type: "delete-address"; addressId: string }
  | { type: "device"; operation: ContactsDeviceOperation };

/** Sample-only tools, kept out of the Ledger Wallet layout's way. */
const SampleTools: React.FC<{ onToggleAdvanced: () => void }> = ({
  onToggleAdvanced,
}) => {
  const { book, loadSamples, reload, clear } = useAddressBookStore();
  const isEmpty =
    book.contactGroups.length === 0 && book.externalAddresses.length === 0;
  return (
    <div className="flex items-center gap-8">
      <Button appearance="gray" size="sm" onClick={loadSamples}>
        Load samples
      </Button>
      <Button appearance="gray" size="sm" onClick={reload}>
        Reload
      </Button>
      <Button appearance="gray" size="sm" onClick={clear} disabled={isEmpty}>
        Reset
      </Button>
      <Button
        appearance="gray"
        size="sm"
        icon={Code}
        onClick={onToggleAdvanced}
        data-testid="contacts-advanced-toggle"
      >
        Advanced
      </Button>
    </div>
  );
};

/**
 * The Contacts page, laid out like Ledger Wallet's: a searchable list beside
 * the selected contact, with every flow in a dialog and every device operation
 * in the device step dialog.
 */
export const ContactsPage: React.FC<{ onShowAdvanced: () => void }> = ({
  onShowAdvanced,
}) => {
  const store = useAddressBookStore();
  const { book } = store;
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [dialog, setDialog] = useState<DialogState>();

  // Fall back to the first contact when nothing (or a deleted one) is selected.
  const selected =
    (selectedId !== undefined ? findGroupById(book, selectedId) : undefined) ??
    book.contactGroups[0];
  const selectedAddresses = useMemo(
    () => (selected ? externalAddressesForGroup(book, selected.id) : []),
    [book, selected],
  );

  const close = useCallback(() => setDialog(undefined), []);
  const runOnDevice = (operation: ContactsDeviceOperation) =>
    setDialog({ type: "device", operation });

  const addressOf = (addressId: string) =>
    book.externalAddresses.find((a) => a.id === addressId);

  let dialogView: React.ReactNode = null;
  switch (dialog?.type) {
    case "add-contact":
      dialogView = (
        <ContactNameDialog
          book={book}
          mode="add"
          requiresDevice={false}
          onClose={close}
          onSubmit={(name) => {
            setSelectedId(store.addContact(name));
            close();
          }}
        />
      );
      break;
    case "edit-contact": {
      const group = findGroupById(book, dialog.groupId);
      if (!group) break;
      dialogView = (
        <ContactNameDialog
          book={book}
          mode="edit"
          groupId={group.id}
          initialName={group.contactName}
          requiresDevice={isRegisteredGroup(group)}
          onClose={close}
          onSubmit={(name) => {
            if (isRegisteredGroup(group)) {
              runOnDevice(renameContactOperation(store, group, name));
            } else {
              store.renameLocal(group.id, name);
              close();
            }
          }}
        />
      );
      break;
    }
    case "delete-contact":
      dialogView = (
        <ConfirmDeleteDialog
          title="Delete contact?"
          description="Deleting this contact will erase all associated addresses."
          onCancel={close}
          onConfirm={() => {
            store.removeContact(dialog.groupId);
            close();
          }}
        />
      );
      break;
    case "add-address": {
      const group = findGroupById(book, dialog.groupId);
      if (!group) break;
      dialogView = (
        <AddAddressDialog
          book={book}
          groupId={group.id}
          onClose={close}
          onSubmit={({ network, identifier, scope }) =>
            runOnDevice(
              registerAddressOperation(store, {
                group,
                family: network.family,
                chainId: network.chainId,
                identifier,
                scope,
              }),
            )
          }
        />
      );
      break;
    }
    case "address-detail": {
      const address = addressOf(dialog.addressId);
      const group = address
        ? findGroupById(book, address.contactGroupId)
        : undefined;
      if (!address || !group) break;
      const family = address.blockchainFamily;
      dialogView = (
        <AddressDetailDialog
          contactName={group.contactName}
          address={address}
          onClose={close}
          onSend={
            isContactsFamily(family)
              ? () => router.push(`/signers/${family}`)
              : undefined
          }
          onEdit={() =>
            setDialog({ type: "edit-address", addressId: address.id })
          }
          onDelete={() =>
            setDialog({ type: "delete-address", addressId: address.id })
          }
        />
      );
      break;
    }
    case "edit-address": {
      const address = addressOf(dialog.addressId);
      const group = address
        ? findGroupById(book, address.contactGroupId)
        : undefined;
      if (!address || !group || !isRegisteredGroup(group)) break;
      dialogView = (
        <EditAddressDialog
          book={book}
          address={address}
          onClose={close}
          onSubmit={(edit) => {
            const operation = editAddressOperation(store, {
              group,
              address,
              ...edit,
            });
            if (operation) runOnDevice(operation);
            else close();
          }}
        />
      );
      break;
    }
    case "delete-address":
      dialogView = (
        <ConfirmDeleteDialog
          title="Delete address?"
          description="This address will be removed from the contact."
          onCancel={close}
          onConfirm={() => {
            store.removeAddress(dialog.addressId);
            close();
          }}
        />
      );
      break;
    case "device":
      dialogView = (
        <DeviceStepDialog
          operation={dialog.operation}
          onClose={close}
          onDone={close}
        />
      );
      break;
    default:
      break;
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-32 p-24"
      data-lumen-scope
      data-testid="contacts-page"
    >
      <NavBar>
        <NavBarTitle as="h1">Contacts</NavBarTitle>
        <NavBarTrailing>
          <div className="flex items-center gap-16">
            <SampleTools onToggleAdvanced={onShowAdvanced} />
            <Button
              appearance="base"
              size="md"
              icon={UserAdd}
              onClick={() => setDialog({ type: "add-contact" })}
              className="shrink-0 whitespace-nowrap"
              data-testid="contacts-add-contact-header"
            >
              Add contact
            </Button>
          </div>
        </NavBarTrailing>
      </NavBar>
      <div className="flex min-h-0 flex-1 gap-16">
        <aside className="flex min-h-0 w-2/5 min-w-[400px] max-w-[445px] shrink-0 flex-col overflow-hidden rounded-lg bg-section p-16">
          <ContactsList
            book={book}
            search={search}
            onSearchChange={setSearch}
            selectedGroupId={selected?.id}
            onSelect={setSelectedId}
            onAddContact={() => setDialog({ type: "add-contact" })}
          />
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg bg-section">
          {selected ? (
            <ContactDetail
              group={selected}
              addresses={selectedAddresses}
              onAddAddress={() =>
                setDialog({ type: "add-address", groupId: selected.id })
              }
              onEdit={() =>
                setDialog({ type: "edit-contact", groupId: selected.id })
              }
              onDelete={() =>
                setDialog({ type: "delete-contact", groupId: selected.id })
              }
              onOpenAddress={(addressId) =>
                setDialog({ type: "address-detail", addressId })
              }
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-24 text-center">
              <p className="body-1-semi-bold text-base">No contacts yet</p>
              <p className="body-2 text-muted">
                Add a contact, or load the sample contacts.
              </p>
            </div>
          )}
        </main>
      </div>
      {dialogView}
    </div>
  );
};
