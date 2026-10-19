import React, { useMemo } from "react";
import {
  Avatar,
  ListItem,
  ListItemContent,
  ListItemDescription,
  ListItemLeading,
  ListItemTitle,
  resolveAvatarColor,
  SearchInput,
  SectionHeader,
  SectionHeaderTitle,
  Spot,
} from "@ledgerhq/lumen-ui-react";
import { Plus, Search } from "@ledgerhq/lumen-ui-react/symbols";

import {
  type AddressBook,
  type ContactGroup,
  externalAddressesForGroup,
} from "@/lib/contacts/addressBook";

/** First letter of the first two words, as Ledger Wallet's avatars. */
function contactInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word.match(/[A-Za-z0-9]/)?.[0] ?? "")
    .filter((initial) => initial.length > 0)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function formatAddressCount(count: number): string {
  // Ledger Wallet's copy: "0 address", "1 address", "2 addresses".
  return `${count} ${count <= 1 ? "address" : "addresses"}`;
}

export const ContactAvatar: React.FC<{
  group: ContactGroup;
  size: "md" | "lg" | "xl";
}> = ({ group, size }) => (
  // The sample's Lumen utilities are `!important`, so they beat the inline
  // color Avatar sets; a more specific class carries the color instead.
  <span
    className="contents"
    style={
      {
        "--contact-avatar-color": resolveAvatarColor(group.id),
      } as React.CSSProperties
    }
  >
    <Avatar
      size={size}
      alt={group.contactName}
      fallbackText={contactInitials(group.contactName)}
      fallbackColor={resolveAvatarColor(group.id)}
      className="[div&]:bg-(--contact-avatar-color)"
      aria-hidden
    />
  </span>
);

type Section = { title: string; groups: ContactGroup[] };

function sectionsOf(groups: ContactGroup[]): Section[] {
  const sorted = [...groups].sort((a, b) =>
    a.contactName.localeCompare(b.contactName, undefined, {
      sensitivity: "base",
    }),
  );
  const sections: Section[] = [];
  for (const group of sorted) {
    const initial = group.contactName.trim().charAt(0).toUpperCase() || "#";
    const title = /[A-Z]/.test(initial) ? initial : "#";
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.groups.push(group);
    else sections.push({ title, groups: [group] });
  }
  return sections;
}

export const ContactsList: React.FC<{
  book: AddressBook;
  search: string;
  onSearchChange: (search: string) => void;
  selectedGroupId: string | undefined;
  onSelect: (groupId: string) => void;
  onAddContact: () => void;
}> = ({
  book,
  search,
  onSearchChange,
  selectedGroupId,
  onSelect,
  onAddContact,
}) => {
  const query = search.trim().toLowerCase();
  const sections = useMemo(
    () =>
      sectionsOf(
        book.contactGroups.filter((g) =>
          g.contactName.toLowerCase().includes(query),
        ),
      ),
    [book.contactGroups, query],
  );
  const noResults = query.length > 0 && sections.length === 0;

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-16"
      data-testid="contacts-list"
    >
      <SearchInput
        value={search}
        placeholder="Search by name"
        aria-label="Search by name"
        onChange={(event) => onSearchChange(event.target.value)}
        onClear={() => onSearchChange("")}
        data-testid="contacts-list-search"
      />
      <div className="min-h-0 flex-1 overflow-auto">
        {noResults ? (
          <div
            className="flex flex-col items-center gap-16 py-32 text-center"
            data-testid="contacts-search-no-results"
          >
            <Spot appearance="icon" icon={Search} size={48} />
            <p className="body-1-semi-bold text-base">No contact found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-16">
            {sections.map((section) => (
              <div key={section.title} className="flex flex-col gap-8">
                <SectionHeader appearance="plain">
                  <SectionHeaderTitle>{section.title}</SectionHeaderTitle>
                </SectionHeader>
                <div className="flex flex-col">
                  {section.groups.map((group) => (
                    <ListItem
                      key={group.id}
                      active={group.id === selectedGroupId}
                      onClick={() => onSelect(group.id)}
                      data-testid={`contacts-row-${group.contactName}`}
                    >
                      <ListItemLeading>
                        <ContactAvatar group={group} size="md" />
                        <ListItemContent>
                          <ListItemTitle>{group.contactName}</ListItemTitle>
                          <ListItemDescription>
                            {formatAddressCount(
                              externalAddressesForGroup(book, group.id).length,
                            )}
                          </ListItemDescription>
                        </ListItemContent>
                      </ListItemLeading>
                    </ListItem>
                  ))}
                </div>
              </div>
            ))}
            <ListItem
              onClick={onAddContact}
              data-testid="contacts-add-contact-row"
            >
              <ListItemLeading>
                <div
                  className="flex size-48 shrink-0 items-center justify-center rounded-full bg-muted-transparent text-base"
                  aria-hidden
                >
                  <Plus size={20} />
                </div>
                <ListItemContent>
                  <ListItemTitle>Add contact</ListItemTitle>
                </ListItemContent>
              </ListItemLeading>
            </ListItem>
          </div>
        )}
      </div>
    </div>
  );
};
