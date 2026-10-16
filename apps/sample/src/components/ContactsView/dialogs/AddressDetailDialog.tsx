import React, { useEffect, useState } from "react";
import { CryptoIcon } from "@ledgerhq/crypto-icons";
import {
  DialogBody,
  DialogHeader,
  Tag,
  TileButton,
} from "@ledgerhq/lumen-ui-react";
import {
  ArrowUp,
  Check,
  Copy,
  PenEdit,
  Trash,
} from "@ledgerhq/lumen-ui-react/symbols";

import { ContactsDialog } from "@/components/ContactsView/dialogs/ContactsDialog";
import { type ExternalAddress } from "@/lib/contacts/addressBook";
import { networkForAddress } from "@/lib/contacts/networks";
import { displayAddress } from "@/lib/contacts/validation";

const COPY_FEEDBACK_MS = 3000;

export const AddressDetailDialog: React.FC<{
  contactName: string;
  address: ExternalAddress;
  onClose: () => void;
  /** Undefined when the sample has no signer page for the family. */
  onSend?: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ contactName, address, onClose, onSend, onEdit, onDelete }) => {
  const [hasCopied, setHasCopied] = useState(false);
  const network = networkForAddress(address.blockchainFamily, address.chainId);
  const fullAddress = displayAddress(address);

  useEffect(() => {
    if (!hasCopied) return;
    const timeoutId = window.setTimeout(
      () => setHasCopied(false),
      COPY_FEEDBACK_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [hasCopied]);

  return (
    <ContactsDialog
      onClose={onClose}
      className="w-[400px] bg-canvas-sheet"
      testId="contacts-address-detail-dialog"
    >
      <DialogHeader title={contactName} onClose={onClose} />
      <DialogBody className="flex flex-col items-center gap-40 p-24">
        <div className="flex flex-col items-center gap-32">
          <CryptoIcon
            ledgerId={network.icon.ledgerId}
            ticker={network.icon.ticker}
            size="56px"
          />
          <div className="flex flex-col items-center gap-8">
            <Tag
              appearance="gray"
              size="sm"
              label={`${network.name} Network`}
            />
            <div className="flex flex-col items-center text-center">
              <p className="heading-3-semi-bold text-base">{address.scope}</p>
              <p
                className="body-2 break-all text-muted"
                data-testid="contacts-address-detail-full-address"
              >
                {fullAddress}
              </p>
            </div>
          </div>
        </div>
        <div className="grid w-full grid-cols-4 gap-8">
          <TileButton icon={ArrowUp} isFull disabled={!onSend} onClick={onSend}>
            Send
          </TileButton>
          <TileButton
            icon={hasCopied ? Check : Copy}
            isFull
            onClick={() => {
              void navigator.clipboard
                .writeText(fullAddress)
                .then(() => setHasCopied(true));
            }}
          >
            {hasCopied ? "Copied" : "Copy"}
          </TileButton>
          <TileButton
            icon={PenEdit}
            isFull
            onClick={onEdit}
            data-testid="contacts-address-detail-edit"
          >
            Edit
          </TileButton>
          <TileButton
            icon={Trash}
            appearance="red"
            isFull
            onClick={onDelete}
            data-testid="contacts-address-detail-delete"
          >
            Delete
          </TileButton>
        </div>
      </DialogBody>
    </ContactsDialog>
  );
};
