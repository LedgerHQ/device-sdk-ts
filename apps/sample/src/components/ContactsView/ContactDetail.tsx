import React, { useMemo } from "react";
import { CryptoIcon } from "@ledgerhq/crypto-icons";
import { bufferToHexaString } from "@ledgerhq/device-management-kit";
import {
  Button,
  IconButton,
  ListItem,
  ListItemContent,
  ListItemDescription,
  ListItemLeading,
  ListItemTitle,
  ListItemTrailing,
  Tag,
} from "@ledgerhq/lumen-ui-react";
import {
  MoreHorizontal,
  PenEdit,
  Plus,
  Trash,
} from "@ledgerhq/lumen-ui-react/symbols";

import {
  ContactAvatar,
  formatAddressCount,
} from "@/components/ContactsView/ContactsList";
import {
  type ContactGroup,
  type ExternalAddress,
  isRegisteredGroup,
} from "@/lib/contacts/addressBook";
import {
  type ContactsNetworkDisplay,
  networkForAddress,
} from "@/lib/contacts/networks";
import { displayAddress } from "@/lib/contacts/validation";

/** `first 8...last 8`, as Ledger Wallet truncates addresses. */
export function truncateAddress(address: string): string {
  return address.length > 19
    ? `${address.slice(0, 8)}...${address.slice(-8)}`
    : address;
}

type NetworkSection = {
  network: ContactsNetworkDisplay;
  addresses: ExternalAddress[];
};

function sectionsByNetwork(addresses: ExternalAddress[]): NetworkSection[] {
  const sections = new Map<string, NetworkSection>();
  for (const address of addresses) {
    const network = networkForAddress(
      address.blockchainFamily,
      address.chainId,
    );
    const section = sections.get(network.id);
    if (section) section.addresses.push(address);
    else sections.set(network.id, { network, addresses: [address] });
  }
  return [...sections.values()];
}

const hex = (bytes: Uint8Array) => bufferToHexaString(bytes, false);

/** Sample-only: the proof material the device issued for this contact. */
const DeviceData: React.FC<{
  group: ContactGroup;
  addresses: ExternalAddress[];
}> = ({ group, addresses }) => {
  const rows: Array<[string, string]> = isRegisteredGroup(group)
    ? [
        ["groupHandle", hex(group.groupHandle)],
        ["hmacProof", hex(group.hmacProof)],
        ...addresses.map((a): [string, string] => [
          `hmacRest · ${a.scope}`,
          hex(a.hmacRest),
        ]),
      ]
    : [];
  return (
    <details
      className="rounded-lg bg-muted-transparent px-16 py-12"
      data-testid="contacts-detail-device-data"
    >
      <summary className="body-2-semi-bold cursor-pointer text-muted">
        Device data (sample only)
      </summary>
      <div className="mt-12 flex flex-col gap-8">
        {rows.length === 0 ? (
          <p className="body-3 text-muted">
            Local only: the contact gets its group handle and name proof when
            its first address is registered on a device.
          </p>
        ) : (
          rows.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-2">
              <p className="body-3 text-muted">{label}</p>
              <p className="body-3 break-all font-mono text-base">{value}</p>
            </div>
          ))
        )}
      </div>
    </details>
  );
};

export const ContactDetail: React.FC<{
  group: ContactGroup;
  addresses: ExternalAddress[];
  onAddAddress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenAddress: (addressId: string) => void;
}> = ({ group, addresses, onAddAddress, onEdit, onDelete, onOpenAddress }) => {
  const sections = useMemo(() => sectionsByNetwork(addresses), [addresses]);

  return (
    <div
      className="flex h-full flex-col gap-32 overflow-y-auto px-16 py-32"
      data-testid="contacts-detail"
    >
      <div className="relative flex shrink-0 flex-col items-center gap-16">
        <div className="absolute -top-16 right-0 flex gap-8">
          <IconButton
            appearance="transparent"
            size="sm"
            icon={PenEdit}
            aria-label="Edit contact"
            onClick={onEdit}
            data-testid="contacts-detail-edit"
          />
          <IconButton
            appearance="transparent"
            size="sm"
            icon={Trash}
            aria-label="Delete contact"
            onClick={onDelete}
            data-testid="contacts-detail-delete"
          />
        </div>
        <ContactAvatar group={group} size="xl" />
        <div className="flex flex-col items-center gap-4">
          <h2
            className="heading-3-semi-bold text-base"
            data-testid="contacts-detail-name"
          >
            {group.contactName}
          </h2>
          <p className="body-2 text-muted">
            {formatAddressCount(addresses.length)}
          </p>
          {!isRegisteredGroup(group) ? (
            <Tag appearance="gray" size="sm" label="Not on a device yet" />
          ) : null}
        </div>
        <Button
          appearance="gray"
          size="sm"
          icon={Plus}
          onClick={onAddAddress}
          data-testid="contacts-detail-add-address"
        >
          Add address
        </Button>
      </div>

      {sections.length === 0 ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-4 px-24 text-center"
          data-testid="contacts-detail-empty-state"
        >
          <p className="body-1-semi-bold text-base">
            No saved addresses for {group.contactName}
          </p>
          <p className="body-2 text-muted">
            Save their wallet addresses to send to them by name next time
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-24">
          {sections.map(({ network, addresses: rows }) => (
            <section key={network.id} className="flex flex-col gap-8">
              <div className="flex items-center gap-8 px-8">
                <CryptoIcon
                  ledgerId={network.icon.ledgerId}
                  ticker={network.icon.ticker}
                  size="16px"
                />
                <p className="body-2 text-muted">{network.name}</p>
              </div>
              <div className="flex flex-col gap-8 overflow-hidden rounded-lg">
                {rows.map((address) => (
                  <ListItem
                    key={address.id}
                    className="bg-surface"
                    onClick={() => onOpenAddress(address.id)}
                    data-testid={`contacts-address-row-${address.scope}`}
                  >
                    <ListItemLeading>
                      <CryptoIcon
                        ledgerId={network.icon.ledgerId}
                        ticker={network.icon.ticker}
                        size="48px"
                      />
                      <ListItemContent>
                        <ListItemTitle>{address.scope}</ListItemTitle>
                        <ListItemDescription>
                          {truncateAddress(displayAddress(address))}
                        </ListItemDescription>
                      </ListItemContent>
                    </ListItemLeading>
                    <ListItemTrailing>
                      <MoreHorizontal size={20} className="text-muted" />
                    </ListItemTrailing>
                  </ListItem>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <DeviceData group={group} addresses={addresses} />
    </div>
  );
};
