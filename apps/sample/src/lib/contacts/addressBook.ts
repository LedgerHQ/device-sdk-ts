/**
 * Canonical, host-owned address-book model for the Contacts playground.
 *
 * The Contacts kit is stateless — it drives device operations and returns proof
 * material, but never stores anything. The host owns the address book: its
 * shape, its serialization, and how device outputs are folded back in. This
 * module is that single canonical contract. It is deliberately framework-free
 * (no React, no DOM beyond the storage helpers) so it can be reused by the
 * playground UI and by signer integrations — the `toProvideContactInput`
 * adapter turns a stored entry into the exact input a signer needs to decorate
 * an upcoming transaction via the kit's `buildProvideContactPayload`.
 *
 * Scope: external addresses only (Ledger-account contacts are out of scope).
 *
 * As in Ledger Wallet, a contact can be created locally before any device
 * operation: it only gets its device credentials (`groupHandle` + `hmacProof`)
 * when its first address is registered.
 *
 * `groupHandle` on {@link ContactGroup} is the canonical, device-issued value.
 * Each {@link ExternalAddress} keeps a copy for operation payloads; that copy
 * must always match its linked group. `id` / `contactGroupId` are client-side
 * identifiers for host storage and UI linking only — they are never device
 * values and never cross into the kit or signer contracts, which link records
 * by the device value `groupHandle`.
 */
import {
  type EditExternalAddressIdentifierOutput,
  type EditExternalAddressScopeOutput,
  type ProvideContactInput,
  type RegisterExternalAddressOutput,
  type RenameContactOutput,
} from "@ledgerhq/device-contacts-kit";
import {
  bufferToHexaString,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import {
  type EvmAddressBook,
  type EvmContactGroup,
} from "@ledgerhq/device-signer-kit-ethereum";
import {
  type SolanaAddressBook,
  type SolanaContactGroup,
} from "@ledgerhq/device-signer-kit-solana";
import {
  encodeTronAddress,
  type TronAddressBook,
  type TronContactGroup,
} from "@ledgerhq/device-signer-kit-tron";

import {
  CONTACTS_FAMILY_LIST,
  type ContactsFamily,
  findContactsFamily,
  isContactsFamily,
} from "@/lib/contacts/families";

export type AddressBook = {
  contactGroups: ContactGroup[];
  externalAddresses: ExternalAddress[];
};

export type ContactGroup = {
  /** Client-side id for host storage / UI linking only. Not a device value. */
  id: string;
  contactName: string;
  /**
   * Canonical device-issued handle for the group. Absent for a local-only
   * contact, until its first address is registered.
   */
  groupHandle?: Uint8Array;
  /** Group-level name proof (rotated by Rename). Absent with `groupHandle`. */
  hmacProof?: Uint8Array;
};

/** A contact group that holds its device credentials. */
export type RegisteredContactGroup = ContactGroup & {
  groupHandle: Uint8Array;
  hmacProof: Uint8Array;
};

export function isRegisteredGroup(
  group: ContactGroup,
): group is RegisteredContactGroup {
  return group.groupHandle !== undefined && group.hmacProof !== undefined;
}

export type ExternalAddress = {
  /** Client-side id for host storage / UI linking only. Not a device value. */
  id: string;
  /** Client-side link to the owning {@link ContactGroup.id}. Not a device value. */
  contactGroupId: string;
  /** Copy of the owning group's canonical handle; must match the linked group. */
  groupHandle: Uint8Array;
  scope: string;
  /**
   * Hex of the identifier bytes (no `0x`) — e.g. the 20-byte Ethereum address,
   * the 21-byte `0x41`-prefixed Tron address or the 32-byte Solana public key. See {@link formatIdentifier}
   * for the family's human-readable form.
   */
  address: string;
  blockchainFamily: string;
  chainId?: bigint;
  /** Address-level proof (rotated by Edit Identifier / Edit Scope). */
  hmacRest: Uint8Array;
};

export const ADDRESS_BOOK_STORAGE_KEY = "dmk-sample-address-book";

export const emptyAddressBook = (): AddressBook => ({
  contactGroups: [],
  externalAddresses: [],
});

// --- sample seed ------------------------------------------------------------
//
// A small set of placeholder contacts for demoing the address-book UI,
// persistence/reload, and the `toProvideContactInput` adapter WITHOUT a device.
//
// The proof material (`groupHandle`, `hmacProof`, `hmacRest`) is fabricated: the
// entries render and round-trip through storage, but the device will REJECT them
// for any real operation (Rename / Edit / Provide) that verifies the HMACs. The
// client ids are fixed so re-seeding is idempotent.

/** Deterministic non-zero bytes, so placeholder proofs look distinct in the UI. */
function placeholderBytes(length: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = (seed + i * 7 + 1) & 0xff;
  }
  return bytes;
}

/** The fixed placeholder contacts, as a standalone address book. */
export function sampleAddressBook(): AddressBook {
  const aliceHandle = placeholderBytes(64, 0x10);
  const bobHandle = placeholderBytes(64, 0x80);
  return {
    contactGroups: [
      {
        id: "sample-group-alice",
        contactName: "Alice (sample)",
        groupHandle: aliceHandle,
        hmacProof: placeholderBytes(32, 0x11),
      },
      {
        id: "sample-group-bob",
        contactName: "Bob (sample)",
        groupHandle: bobHandle,
        hmacProof: placeholderBytes(32, 0x81),
      },
    ],
    externalAddresses: [
      {
        id: "sample-address-alice-main",
        contactGroupId: "sample-group-alice",
        groupHandle: aliceHandle,
        scope: "Eth main",
        address: "de0b295669a9fd93d5f28d9ec85e40f4cb697bae",
        blockchainFamily: "ethereum",
        chainId: 1n,
        hmacRest: placeholderBytes(32, 0x12),
      },
      {
        id: "sample-address-alice-cold",
        contactGroupId: "sample-group-alice",
        groupHandle: aliceHandle,
        scope: "Eth cold",
        address: "70997970c51812dc3a010c7d01b50e0d17dc79c8",
        blockchainFamily: "ethereum",
        chainId: 1n,
        hmacRest: placeholderBytes(32, 0x13),
      },
      {
        id: "sample-address-bob-main",
        contactGroupId: "sample-group-bob",
        groupHandle: bobHandle,
        scope: "Eth main",
        address: "3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
        blockchainFamily: "ethereum",
        chainId: 1n,
        hmacRest: placeholderBytes(32, 0x82),
      },
      {
        id: "sample-address-bob-sol",
        contactGroupId: "sample-group-bob",
        groupHandle: bobHandle,
        scope: "Sol main",
        // Base58 7J922pfkw6Kz1TtEpr5jvBJEV9k2wbBG4L981r1NBPpu.
        address:
          "5d8a0fa0df8d8bb1b49d59c9b4f0fb2c8e8ee4b5c3d0a1f2e3d4c5b6a7980112",
        blockchainFamily: "solana",
        hmacRest: placeholderBytes(32, 0x83),
      },
    ],
  };
}

/**
 * Merge the placeholder {@link sampleAddressBook} into an existing book,
 * idempotently: groups and addresses are keyed by their fixed sample ids, so
 * re-seeding never duplicates and never disturbs real, device-registered
 * entries already in the book.
 */
export function addSampleContacts(book: AddressBook): AddressBook {
  const samples = sampleAddressBook();
  const existingGroupIds = new Set(book.contactGroups.map((g) => g.id));
  const existingAddressIds = new Set(book.externalAddresses.map((a) => a.id));
  return {
    contactGroups: [
      ...book.contactGroups,
      ...samples.contactGroups.filter((g) => !existingGroupIds.has(g.id)),
    ],
    externalAddresses: [
      ...book.externalAddresses,
      ...samples.externalAddresses.filter((a) => !existingAddressIds.has(a.id)),
    ],
  };
}

// --- blockchain families ----------------------------------------------------
//
// The per-family rules live in `families.ts`; these helpers apply them to the
// form fields and stored values of the address book.

export type { ContactsFamily } from "@/lib/contacts/families";

export const CONTACTS_APP_BY_FAMILY: Readonly<Record<ContactsFamily, string>> =
  Object.fromEntries(
    CONTACTS_FAMILY_LIST.map((d) => [d.family, d.appName]),
  ) as Record<ContactsFamily, string>;

export const CONTACTS_FAMILY_OPTIONS: Array<{
  label: string;
  value: ContactsFamily;
}> = CONTACTS_FAMILY_LIST.map((d) => ({ label: d.label, value: d.family }));

/** Narrow a stored family string, falling back to Ethereum for unknown ones. */
export function toContactsFamily(family: string | undefined): ContactsFamily {
  return family !== undefined && isContactsFamily(family) ? family : "ethereum";
}

/** Only families with a CHAIN_ID carry one; the kit would send it for any. */
export function chainIdForFamily(
  family: string,
  chainId: string,
): bigint | undefined {
  return findContactsFamily(family)?.hasChainId && chainId.trim().length > 0
    ? BigInt(chainId.trim())
    : undefined;
}

// --- byte / hex helpers -----------------------------------------------------

/**
 * Parse a hex form field (optional `0x`) into bytes, naming the field on
 * failure so a typo surfaces here instead of as an opaque device error.
 */
export function parseHexField(value: string, field: string): Uint8Array {
  const bytes = hexaStringToBuffer(value.trim());
  if (bytes === null) {
    throw new Error(`${field} is not a valid hex string: "${value}"`);
  }
  return bytes;
}

/**
 * Parse an identifier form field into the identifier bytes the device signs
 * over, in the family's address form (see `families.ts`). Unknown families take
 * hex.
 */
export function parseIdentifier(
  family: string,
  value: string,
  field: string,
): Uint8Array {
  const descriptor = findContactsFamily(family);
  if (!descriptor) return parseHexField(value, field);
  const bytes = descriptor.parse(value);
  if (!bytes) {
    throw new Error(
      `${field} is not a valid ${descriptor.label} address: "${value}"`,
    );
  }
  return bytes;
}

/** The family's human-readable form of identifier bytes (hex if unknown). */
export function formatIdentifier(family: string, bytes: Uint8Array): string {
  return (
    findContactsFamily(family)?.format(bytes) ??
    bufferToHexaString(bytes, false)
  );
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// --- lookups ----------------------------------------------------------------

export function findGroupByHandle(
  book: AddressBook,
  groupHandle: Uint8Array,
): ContactGroup | undefined {
  return book.contactGroups.find(
    (g) =>
      g.groupHandle !== undefined && bytesEqual(g.groupHandle, groupHandle),
  );
}

export function findGroupById(
  book: AddressBook,
  id: string,
): ContactGroup | undefined {
  return book.contactGroups.find((g) => g.id === id);
}

export function externalAddressesForGroup(
  book: AddressBook,
  groupId: string,
): ExternalAddress[] {
  return book.externalAddresses.filter((a) => a.contactGroupId === groupId);
}

// --- reducers ---------------------------------------------------------------
//
// Each reducer is pure — it returns a new AddressBook and mutates nothing. Each
// folds in exactly one device output, touching ONLY the field(s) that operation
// changed plus the proof value it returned. Records are matched by the device
// value `groupHandle` (and identifier / scope where needed), never by the
// client-side ids.

/**
 * Fold a REGISTER EXTERNAL ADDRESS output into the book.
 *
 * `mode: "create"` yields a new contact group — or, when `localGroupId` names a
 * local-only contact, gives that contact the returned device credentials;
 * `mode: "link"` reuses the existing group (matched by `groupHandle`) and adds
 * the address to it. If a link output arrives for a group not yet in the book,
 * the group is materialized from the output so the book stays self-consistent.
 * Re-registering the same address within a group upserts it (scope +
 * `hmacRest`) instead of duplicating.
 */
export function applyRegister(
  book: AddressBook,
  output: RegisterExternalAddressOutput,
  localGroupId?: string,
): AddressBook {
  const addressHex = bufferToHexaString(output.identifier, false);

  let group = findGroupByHandle(book, output.groupHandle);
  let contactGroups = book.contactGroups;

  const localGroup =
    localGroupId !== undefined ? findGroupById(book, localGroupId) : undefined;
  if (!group && localGroup && !isRegisteredGroup(localGroup)) {
    const registered: ContactGroup = {
      ...localGroup,
      contactName: output.contactName,
      groupHandle: output.groupHandle,
      hmacProof: output.hmacProof,
    };
    group = registered;
    contactGroups = contactGroups.map((g) =>
      g.id === registered.id ? registered : g,
    );
  }

  if (!group) {
    // "create", or a "link" whose group isn't in the local book yet.
    group = {
      id: newId(),
      contactName: output.contactName,
      groupHandle: output.groupHandle,
      hmacProof: output.hmacProof,
    };
    contactGroups = [...contactGroups, group];
  }

  // Match by device values (groupHandle + address), per the reducer contract —
  // not by the client-side contactGroupId, which may be missing or stale in a
  // partially-written book. On upsert we also re-link the client-side id and
  // refresh the handle copy, healing any such inconsistency.
  const existing = book.externalAddresses.find(
    (a) =>
      bytesEqual(a.groupHandle, output.groupHandle) && a.address === addressHex,
  );

  let externalAddresses: ExternalAddress[];
  if (existing) {
    externalAddresses = book.externalAddresses.map((a) =>
      a.id === existing.id
        ? {
            ...a,
            contactGroupId: group.id,
            groupHandle: output.groupHandle,
            scope: output.scope,
            blockchainFamily: output.blockchainFamily,
            chainId: output.chainId,
            hmacRest: output.hmacRest,
          }
        : a,
    );
  } else {
    externalAddresses = [
      ...book.externalAddresses,
      {
        id: newId(),
        contactGroupId: group.id,
        groupHandle: output.groupHandle,
        scope: output.scope,
        address: addressHex,
        blockchainFamily: output.blockchainFamily,
        chainId: output.chainId,
        hmacRest: output.hmacRest,
      },
    ];
  }

  return { contactGroups, externalAddresses };
}

/**
 * Fold a RENAME CONTACT output into the book: update the matched group's name
 * and rotate its group-level `hmacProof`. Nothing else changes.
 */
export function applyRename(
  book: AddressBook,
  output: RenameContactOutput,
): AddressBook {
  return {
    ...book,
    contactGroups: book.contactGroups.map((g) =>
      g.groupHandle !== undefined &&
      bytesEqual(g.groupHandle, output.groupHandle)
        ? { ...g, contactName: output.contactName, hmacProof: output.hmacProof }
        : g,
    ),
  };
}

/**
 * Fold an EDIT IDENTIFIER output into the book: on the entry matched by group
 * handle + previous address, replace the address and rotate the address-level
 * `hmacRest`. The group-level `hmacProof` is untouched.
 */
export function applyEditIdentifier(
  book: AddressBook,
  output: EditExternalAddressIdentifierOutput,
): AddressBook {
  const previousHex = bufferToHexaString(output.previousIdentifier, false);
  const nextHex = bufferToHexaString(output.identifier, false);
  return {
    ...book,
    externalAddresses: book.externalAddresses.map((a) =>
      bytesEqual(a.groupHandle, output.groupHandle) && a.address === previousHex
        ? { ...a, address: nextHex, hmacRest: output.hmacRest }
        : a,
    ),
  };
}

/**
 * Fold an EDIT SCOPE output into the book: on the entry matched by group handle
 * + identifier + previous scope, replace the scope and rotate the address-level
 * `hmacRest`. The identifier and the group-level `hmacProof` are untouched.
 */
export function applyEditScope(
  book: AddressBook,
  output: EditExternalAddressScopeOutput,
): AddressBook {
  const identifierHex = bufferToHexaString(output.identifier, false);
  return {
    ...book,
    externalAddresses: book.externalAddresses.map((a) =>
      bytesEqual(a.groupHandle, output.groupHandle) &&
      a.address === identifierHex &&
      a.scope === output.previousScope
        ? { ...a, scope: output.scope, hmacRest: output.hmacRest }
        : a,
    ),
  };
}

// --- local-only edits -------------------------------------------------------
//
// Ledger Wallet keeps these off the device: creating a contact, renaming one
// that has no address yet, and deleting contacts or addresses.

/** Add a local-only contact (no device credentials yet). */
export function addLocalContact(
  book: AddressBook,
  contact: { id: string; contactName: string },
): AddressBook {
  return {
    ...book,
    contactGroups: [
      ...book.contactGroups,
      { id: contact.id, contactName: contact.contactName },
    ],
  };
}

/** Rename a local-only contact; a registered one is renamed on the device. */
export function renameLocalContact(
  book: AddressBook,
  groupId: string,
  contactName: string,
): AddressBook {
  return {
    ...book,
    contactGroups: book.contactGroups.map((g) =>
      g.id === groupId && !isRegisteredGroup(g) ? { ...g, contactName } : g,
    ),
  };
}

/** Delete a contact and all of its addresses. */
export function deleteContact(book: AddressBook, groupId: string): AddressBook {
  return {
    contactGroups: book.contactGroups.filter((g) => g.id !== groupId),
    externalAddresses: book.externalAddresses.filter(
      (a) => a.contactGroupId !== groupId,
    ),
  };
}

export function deleteExternalAddress(
  book: AddressBook,
  addressId: string,
): AddressBook {
  return {
    ...book,
    externalAddresses: book.externalAddresses.filter((a) => a.id !== addressId),
  };
}

// --- signer adapter ---------------------------------------------------------

/**
 * Turn a stored contact group + one of its external addresses into the exact
 * {@link ProvideContactInput} a signer integration feeds to the kit's
 * `buildProvideContactPayload` before a signing flow. Combines the group-level
 * name material with the matched address-level material.
 *
 * @throws if the address does not belong to the group (its `groupHandle` copy
 *   must match the group's canonical handle).
 */
export function toProvideContactInput(
  group: ContactGroup,
  address: ExternalAddress,
): ProvideContactInput {
  if (address.contactGroupId !== group.id) {
    throw new Error("External address does not belong to the given group");
  }
  if (!isRegisteredGroup(group)) {
    throw new Error("The contact group has no device credentials yet");
  }
  if (!bytesEqual(address.groupHandle, group.groupHandle)) {
    throw new Error(
      "External address groupHandle copy does not match the group's canonical handle",
    );
  }
  return {
    contactName: group.contactName,
    scope: address.scope,
    identifier: parseHexField(address.address, "address"),
    groupHandle: group.groupHandle,
    hmacProof: group.hmacProof,
    hmacRest: address.hmacRest,
    blockchainFamily: address.blockchainFamily,
    chainId: address.chainId,
  };
}

/**
 * Project the book onto the {@link TronAddressBook} snapshot the Tron signer
 * takes via `withAddressBook`: Tron-family addresses only, nested under their
 * group, with the address in base58. Groups with no Tron address are dropped.
 */
export function toTronAddressBook(book: AddressBook): TronAddressBook {
  const contactGroups: TronContactGroup[] = [];
  for (const group of book.contactGroups.filter(isRegisteredGroup)) {
    const externalAddresses = externalAddressesForGroup(book, group.id)
      .filter((a) => a.blockchainFamily === "tron")
      .map((a) => ({
        scope: a.scope,
        address: encodeTronAddress(parseHexField(a.address, "address")),
        hmacRest: a.hmacRest,
      }));
    if (externalAddresses.length === 0) continue;
    contactGroups.push({
      contactName: group.contactName,
      groupHandle: group.groupHandle,
      hmacProof: group.hmacProof,
      externalAddresses,
    });
  }
  return { contactGroups, ledgerAccounts: [] };
}

/**
 * Project the book onto the {@link SolanaAddressBook} snapshot the Solana
 * signer takes via `withAddressBook`: Solana-family addresses only, nested
 * under their group, with the wallet public key in base58 (the signer derives
 * the token accounts itself). Groups with no Solana address are dropped.
 */
export function toSolanaAddressBook(book: AddressBook): SolanaAddressBook {
  const contactGroups: SolanaContactGroup[] = [];
  for (const group of book.contactGroups.filter(isRegisteredGroup)) {
    const externalAddresses = externalAddressesForGroup(book, group.id)
      .filter((a) => a.blockchainFamily === "solana")
      .map((a) => ({
        scope: a.scope,
        address: formatIdentifier(
          "solana",
          parseHexField(a.address, "address"),
        ),
        hmacRest: a.hmacRest,
      }));
    if (externalAddresses.length === 0) continue;
    contactGroups.push({
      contactName: group.contactName,
      groupHandle: group.groupHandle,
      hmacProof: group.hmacProof,
      externalAddresses,
    });
  }
  return { contactGroups, ledgerAccounts: [] };
}

/**
 * Project the book onto the {@link EvmAddressBook} snapshot the Ethereum signer
 * takes via `withAddressBook`: Ethereum-family addresses that carry a chainId
 * (the EVM signer matches on address + chainId), nested under their group, with
 * a `0x`-prefixed address. Groups with no such address are dropped.
 */
export function toEvmAddressBook(book: AddressBook): EvmAddressBook {
  const contactGroups: EvmContactGroup[] = [];
  for (const group of book.contactGroups.filter(isRegisteredGroup)) {
    const externalAddresses = externalAddressesForGroup(book, group.id).flatMap(
      (a) =>
        a.blockchainFamily === "ethereum" && a.chainId !== undefined
          ? [
              {
                scope: a.scope,
                address: bufferToHexaString(
                  parseHexField(a.address, "address"),
                ),
                chainId: a.chainId,
                hmacRest: a.hmacRest,
              },
            ]
          : [],
    );
    if (externalAddresses.length === 0) continue;
    contactGroups.push({
      contactName: group.contactName,
      groupHandle: group.groupHandle,
      hmacProof: group.hmacProof,
      externalAddresses,
    });
  }
  return { contactGroups, ledgerAccounts: [] };
}

// --- serialization + storage ------------------------------------------------
//
// Uint8Array (hex) and bigint (decimal string) are not JSON-native, so the book
// is serialized through an explicit wire shape and restored on load.

type SerializedContactGroup = {
  id: string;
  contactName: string;
  groupHandle?: string;
  hmacProof?: string;
};

type SerializedExternalAddress = {
  id: string;
  contactGroupId: string;
  groupHandle: string;
  scope: string;
  address: string;
  blockchainFamily: string;
  chainId?: string;
  hmacRest: string;
};

type SerializedAddressBook = {
  contactGroups: SerializedContactGroup[];
  externalAddresses: SerializedExternalAddress[];
};

export function serializeAddressBook(book: AddressBook): SerializedAddressBook {
  return {
    contactGroups: book.contactGroups.map((g) => ({
      id: g.id,
      contactName: g.contactName,
      ...(isRegisteredGroup(g)
        ? {
            groupHandle: bufferToHexaString(g.groupHandle, false),
            hmacProof: bufferToHexaString(g.hmacProof, false),
          }
        : {}),
    })),
    externalAddresses: book.externalAddresses.map((a) => ({
      id: a.id,
      contactGroupId: a.contactGroupId,
      groupHandle: bufferToHexaString(a.groupHandle, false),
      scope: a.scope,
      address: a.address,
      blockchainFamily: a.blockchainFamily,
      ...(a.chainId !== undefined ? { chainId: a.chainId.toString() } : {}),
      hmacRest: bufferToHexaString(a.hmacRest, false),
    })),
  };
}

export function deserializeAddressBook(
  raw: SerializedAddressBook,
): AddressBook {
  return {
    contactGroups: (raw.contactGroups ?? []).map((g) => ({
      id: g.id,
      contactName: g.contactName,
      ...(g.groupHandle !== undefined && g.hmacProof !== undefined
        ? {
            groupHandle: parseHexField(g.groupHandle, "groupHandle"),
            hmacProof: parseHexField(g.hmacProof, "hmacProof"),
          }
        : {}),
    })),
    externalAddresses: (raw.externalAddresses ?? []).map((a) => ({
      id: a.id,
      contactGroupId: a.contactGroupId,
      groupHandle: parseHexField(a.groupHandle, "groupHandle"),
      scope: a.scope,
      address: a.address,
      blockchainFamily: a.blockchainFamily,
      chainId: a.chainId !== undefined ? BigInt(a.chainId) : undefined,
      hmacRest: parseHexField(a.hmacRest, "hmacRest"),
    })),
  };
}

export function loadAddressBook(): AddressBook {
  if (typeof window === "undefined") return emptyAddressBook();
  const raw = window.localStorage.getItem(ADDRESS_BOOK_STORAGE_KEY);
  if (!raw) return emptyAddressBook();
  try {
    return deserializeAddressBook(JSON.parse(raw) as SerializedAddressBook);
  } catch {
    return emptyAddressBook();
  }
}

// Same-tab change notification: the `storage` event only reaches OTHER tabs,
// and the signer providers outlive the Contacts page, so they need their own
// signal to rebuild with the latest book.
const ADDRESS_BOOK_CHANGED_EVENT = "dmk-sample-address-book-changed";

export function saveAddressBook(book: AddressBook): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(serializeAddressBook(book));
  if (window.localStorage.getItem(ADDRESS_BOOK_STORAGE_KEY) === raw) return;
  window.localStorage.setItem(ADDRESS_BOOK_STORAGE_KEY, raw);
  window.dispatchEvent(new Event(ADDRESS_BOOK_CHANGED_EVENT));
}

export function clearAddressBook(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADDRESS_BOOK_STORAGE_KEY);
  window.dispatchEvent(new Event(ADDRESS_BOOK_CHANGED_EVENT));
}

/**
 * Call `listener` whenever the stored book changes, in this tab or another.
 * Returns the unsubscribe function.
 */
export function subscribeToAddressBook(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === ADDRESS_BOOK_STORAGE_KEY) listener();
  };
  window.addEventListener(ADDRESS_BOOK_CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ADDRESS_BOOK_CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
