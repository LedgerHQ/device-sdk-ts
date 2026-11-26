import React, { useState } from "react";
import {
  Button,
  DialogBody,
  DialogFooter,
  DialogHeader,
} from "@ledgerhq/lumen-ui-react";
import { LedgerLogo } from "@ledgerhq/lumen-ui-react/symbols";

import { AddressFields } from "@/components/ContactsView/dialogs/AddressFields";
import { ContactsDialog } from "@/components/ContactsView/dialogs/ContactsDialog";
import {
  type AddressBook,
  type ExternalAddress,
} from "@/lib/contacts/addressBook";
import { findContactsFamily } from "@/lib/contacts/families";
import {
  checkAddress,
  displayAddress,
  validateAddressLabel,
} from "@/lib/contacts/validation";

export type AddressEdit = {
  /** Undefined when the address is unchanged. */
  newIdentifier?: Uint8Array;
  /** Undefined when the name is unchanged. */
  newScope?: string;
};

/**
 * Edit address: the address and its name. The network is fixed once the
 * address exists, as in Ledger Wallet.
 */
export const EditAddressDialog: React.FC<{
  book: AddressBook;
  address: ExternalAddress;
  onClose: () => void;
  onSubmit: (edit: AddressEdit) => void;
}> = ({ book, address, onClose, onSubmit }) => {
  const initialAddress = displayAddress(address);
  const [value, setValue] = useState(initialAddress);
  const [label, setLabel] = useState(address.scope);

  const family = findContactsFamily(address.blockchainFamily);
  const addressCheck = family
    ? checkAddress(book, family, address.chainId, value, address.id)
    : ({ status: "invalid", message: "Unsupported network." } as const);
  const labelError = validateAddressLabel(
    book,
    address.contactGroupId,
    label,
    address.id,
  );

  const addressChanged =
    addressCheck.status === "valid" &&
    family !== undefined &&
    family.format(addressCheck.identifier) !== initialAddress;
  const scopeChanged = label.trim() !== address.scope;
  const canSubmit =
    addressCheck.status === "valid" &&
    label.trim().length > 0 &&
    labelError === undefined &&
    (addressChanged || scopeChanged);

  return (
    <ContactsDialog
      onClose={onClose}
      className="w-[400px] pb-24"
      testId="contacts-edit-address-dialog"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || addressCheck.status !== "valid") return;
          onSubmit({
            newIdentifier: addressChanged ? addressCheck.identifier : undefined,
            newScope: scopeChanged ? label.trim() : undefined,
          });
        }}
      >
        <DialogHeader title="Edit address" onClose={onClose} />
        <DialogBody className="px-24 pb-24">
          <AddressFields
            placeholder={family?.addressPlaceholder ?? "Address"}
            address={value}
            addressCheck={addressCheck}
            onAddressChange={setValue}
            label={label}
            labelError={labelError}
            onLabelChange={setLabel}
          />
        </DialogBody>
        <DialogFooter className="px-24">
          <Button
            type="submit"
            appearance="base"
            size="lg"
            isFull
            icon={LedgerLogo}
            disabled={!canSubmit}
            data-testid="contacts-edit-address-submit"
          >
            Apply changes
          </Button>
        </DialogFooter>
      </form>
    </ContactsDialog>
  );
};
