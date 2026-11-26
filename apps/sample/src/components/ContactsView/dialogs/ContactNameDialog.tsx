import React, { useState } from "react";
import {
  Button,
  DialogBody,
  DialogHeader,
  TextInput,
} from "@ledgerhq/lumen-ui-react";
import { InformationFill, LedgerLogo } from "@ledgerhq/lumen-ui-react/symbols";

import { ContactsDialog } from "@/components/ContactsView/dialogs/ContactsDialog";
import { type AddressBook } from "@/lib/contacts/addressBook";
import {
  CONTACT_NAME_MAX_LENGTH,
  validateContactName,
} from "@/lib/contacts/validation";

export const NamingDisclaimer: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex gap-8 rounded-sm bg-muted px-12 py-10 text-base">
    <InformationFill size={24} className="mt-2 shrink-0" aria-hidden />
    <p className="body-2">{text}</p>
  </div>
);

/**
 * Add contact (local only) or Edit contact (on the device once the contact has
 * an address, signalled by the Ledger logo on the button).
 */
export const ContactNameDialog: React.FC<{
  book: AddressBook;
  mode: "add" | "edit";
  groupId?: string;
  initialName?: string;
  requiresDevice: boolean;
  onClose: () => void;
  onSubmit: (contactName: string) => void;
}> = ({
  book,
  mode,
  groupId,
  initialName = "",
  requiresDevice,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(initialName);
  const error = validateContactName(book, name, groupId);
  const trimmed = name.trim();
  const canSubmit =
    trimmed.length > 0 && error === undefined && trimmed !== initialName;

  return (
    <ContactsDialog
      onClose={onClose}
      className="pb-24"
      testId={`contacts-${mode}-contact-dialog`}
    >
      <DialogHeader
        density="expanded"
        title={mode === "add" ? "Add contact" : "Edit contact"}
        onClose={onClose}
      />
      <DialogBody className="p-0">
        <form
          className="flex flex-col gap-24 px-24 pb-24 pt-12"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) onSubmit(trimmed);
          }}
        >
          <TextInput
            autoFocus
            label="Contact name"
            value={name}
            maxCount={CONTACT_NAME_MAX_LENGTH}
            maxLength={CONTACT_NAME_MAX_LENGTH}
            status={error ? "error" : undefined}
            helperText={error}
            onChange={(event) => setName(event.target.value)}
            onClear={() => setName("")}
            data-testid="contacts-contact-name-input"
          />
          <NamingDisclaimer
            text={
              mode === "add"
                ? "For privacy, avoid full names. Use a nickname or just a first name + initial, e.g. 'John S.'"
                : "For your privacy, avoid full names and surnames. Use a nickname or just a first name + initial, e.g. 'John S.'"
            }
          />
          <Button
            type="submit"
            appearance="base"
            size="lg"
            isFull
            icon={requiresDevice ? LedgerLogo : undefined}
            disabled={!canSubmit}
            data-testid="contacts-contact-name-submit"
          >
            {mode === "add" ? "Add contact" : "Apply changes"}
          </Button>
        </form>
      </DialogBody>
    </ContactsDialog>
  );
};
