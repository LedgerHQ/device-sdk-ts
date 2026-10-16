import React, { useMemo, useState } from "react";
import { CryptoIcon } from "@ledgerhq/crypto-icons";
import {
  Banner,
  Button,
  DialogBody,
  DialogFooter,
  DialogHeader,
  ListItem,
  ListItemContent,
  ListItemDescription,
  ListItemLeading,
  ListItemTitle,
  SearchInput,
} from "@ledgerhq/lumen-ui-react";
import { LedgerLogo } from "@ledgerhq/lumen-ui-react/symbols";

import { AddressFields } from "@/components/ContactsView/dialogs/AddressFields";
import { ContactsDialog } from "@/components/ContactsView/dialogs/ContactsDialog";
import { type AddressBook } from "@/lib/contacts/addressBook";
import { CONTACTS_FAMILIES } from "@/lib/contacts/families";
import {
  CONTACTS_NETWORKS,
  type ContactsNetwork,
} from "@/lib/contacts/networks";
import { checkAddress, validateAddressLabel } from "@/lib/contacts/validation";

export type NewAddress = {
  network: ContactsNetwork;
  identifier: Uint8Array;
  scope: string;
};

const NetworkStep: React.FC<{
  onSelect: (network: ContactsNetwork) => void;
}> = ({ onSelect }) => {
  const [search, setSearch] = useState("");
  const networks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return CONTACTS_NETWORKS.filter((n) =>
      n.name.toLowerCase().includes(query),
    );
  }, [search]);
  return (
    <div className="flex flex-col gap-16 px-24 pb-24">
      <SearchInput
        autoFocus
        value={search}
        placeholder="Search network"
        aria-label="Search network"
        onChange={(event) => setSearch(event.target.value)}
        onClear={() => setSearch("")}
      />
      <div className="flex max-h-[420px] flex-col overflow-auto">
        {networks.map((network) => (
          <ListItem
            key={network.id}
            onClick={() => onSelect(network)}
            data-testid={`contacts-network-${network.id}`}
          >
            <ListItemLeading>
              <CryptoIcon
                ledgerId={network.icon.ledgerId}
                ticker={network.icon.ticker}
                size="40px"
              />
              <ListItemContent>
                <ListItemTitle>{network.name}</ListItemTitle>
                <ListItemDescription>
                  {CONTACTS_FAMILIES[network.family].appName} app
                  {network.chainId !== undefined
                    ? ` · chainId ${network.chainId}`
                    : ""}
                </ListItemDescription>
              </ListItemContent>
            </ListItemLeading>
          </ListItem>
        ))}
      </div>
    </div>
  );
};

/** Add address: pick a network, enter the address and its name, then device. */
export const AddAddressDialog: React.FC<{
  book: AddressBook;
  groupId: string;
  onClose: () => void;
  onSubmit: (address: NewAddress) => void;
}> = ({ book, groupId, onClose, onSubmit }) => {
  const [network, setNetwork] = useState<ContactsNetwork>();
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");

  const family = network ? CONTACTS_FAMILIES[network.family] : undefined;
  const addressCheck = family
    ? checkAddress(book, family, network?.chainId, address)
    : ({ status: "empty" } as const);
  const labelError = validateAddressLabel(book, groupId, label);
  const canSubmit =
    addressCheck.status === "valid" &&
    label.trim().length > 0 &&
    labelError === undefined;

  return (
    <ContactsDialog
      onClose={onClose}
      className="w-[400px] pb-24"
      testId="contacts-add-address-dialog"
    >
      {!network || !family ? (
        <>
          <DialogHeader title="Select network" onClose={onClose} />
          <DialogBody className="p-0">
            <NetworkStep onSelect={setNetwork} />
          </DialogBody>
        </>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit && addressCheck.status === "valid") {
              onSubmit({
                network,
                identifier: addressCheck.identifier,
                scope: label.trim(),
              });
            }
          }}
        >
          <DialogHeader
            title="Enter address"
            description={network.name}
            onBack={() => setNetwork(undefined)}
            onClose={onClose}
          />
          <DialogBody className="flex flex-col gap-24 px-24 pb-24">
            <AddressFields
              placeholder={family.addressPlaceholder}
              address={address}
              addressCheck={addressCheck}
              onAddressChange={setAddress}
              label={label}
              labelError={labelError}
              onLabelChange={setLabel}
            />
            {family.availabilityNote ? (
              <Banner
                appearance="warning"
                title={`${family.label} support`}
                description={family.availabilityNote}
                data-testid="contacts-family-availability-note"
              />
            ) : null}
          </DialogBody>
          <DialogFooter className="px-24">
            <Button
              type="submit"
              appearance="base"
              size="lg"
              isFull
              icon={LedgerLogo}
              disabled={!canSubmit}
              data-testid="contacts-add-address-submit"
            >
              Continue to review
            </Button>
          </DialogFooter>
        </form>
      )}
    </ContactsDialog>
  );
};
