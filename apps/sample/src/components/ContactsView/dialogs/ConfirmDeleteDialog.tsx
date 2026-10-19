import React from "react";
import {
  Button,
  DialogBody,
  DialogHeader,
  Spot,
} from "@ledgerhq/lumen-ui-react";
import { Trash } from "@ledgerhq/lumen-ui-react/symbols";

import { ContactsDialog } from "@/components/ContactsView/dialogs/ContactsDialog";

/** Delete contact / Delete address. Local only, as in Ledger Wallet. */
export const ConfirmDeleteDialog: React.FC<{
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}> = ({ title, description, onCancel, onConfirm }) => (
  <ContactsDialog
    onClose={onCancel}
    className="w-[400px] bg-canvas-sheet pb-24"
    testId="contacts-confirm-delete-dialog"
  >
    <DialogHeader density="compact" onClose={onCancel} />
    <DialogBody className="flex flex-col items-center gap-32 px-24 pb-24 text-center">
      <div className="flex flex-col items-center gap-24">
        <Spot appearance="icon" icon={Trash} size={56} />
        <div className="flex flex-col gap-8">
          <h2 className="heading-3-semi-bold text-base">{title}</h2>
          <p className="body-2 text-muted">{description}</p>
        </div>
      </div>
      <div className="flex w-full gap-16">
        <Button appearance="gray" size="lg" isFull onClick={onCancel}>
          Cancel
        </Button>
        <Button
          appearance="red"
          size="lg"
          isFull
          onClick={onConfirm}
          data-testid="contacts-confirm-delete"
        >
          Delete
        </Button>
      </div>
    </DialogBody>
  </ContactsDialog>
);
