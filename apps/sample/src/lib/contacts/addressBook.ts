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

export type AddressBook = {
  contactGroups: ContactGroup[];
  externalAddresses: ExternalAddress[];
};

export type ContactGroup = {
  /** Client-side id for host storage / UI linking only. Not a device value. */
  id: string;
  contactName: string;
  /** Canonical device-issued handle for the group. */
  groupHandle: Uint8Array;
  /** Group-level name proof (rotated by Rename). */
  hmacProof: Uint8Array;
};

export type ExternalAddress = {
  /** Client-side id for host storage / UI linking only. Not a device value. */
  id: string;
  /** Client-side link to the owning {@link ContactGroup.id}. Not a device value. */
  contactGroupId: string;
  /** Copy of the owning group's canonical handle; must match the linked group. */
  groupHandle: Uint8Array;
  scope: string;
  /** Hex of the identifier bytes (no `0x`) — for Ethereum, the 20-byte address. */
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

// --- byte / hex helpers -----------------------------------------------------

export function hexToBytes(hex: string): Uint8Array {
  const raw = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
  if (raw.length % 2 !== 0) {
    throw new Error(`Hex value has an odd length: "${hex}"`);
  }
  if (!/^[0-9a-fA-F]*$/.test(raw)) {
    // Fail fast — otherwise parseInt would coerce non-hex to NaN → 0, silently
    // producing wrong bytes and confusing downstream device errors.
    throw new Error(`Hex value contains non-hex characters: "${hex}"`);
  }
  const bytes = new Uint8Array(raw.length / 2);
  for (let i = 0; i < raw.length; i += 2) {
    bytes[i / 2] = parseInt(raw.slice(i, i + 2), 16);
  }
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function newId(): string {
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
  return book.contactGroups.find((g) => bytesEqual(g.groupHandle, groupHandle));
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
 * `mode: "create"` yields a new contact group; `mode: "link"` reuses the
 * existing group (matched by `groupHandle`) and adds the address to it. If a
 * link output arrives for a group not yet in the book, the group is
 * materialized from the output so the book stays self-consistent. Re-registering
 * the same address within a group upserts it (scope + `hmacRest`) instead of
 * duplicating.
 */
export function applyRegister(
  book: AddressBook,
  output: RegisterExternalAddressOutput,
): AddressBook {
  const addressHex = bytesToHex(output.identifier);

  let group = findGroupByHandle(book, output.groupHandle);
  let contactGroups = book.contactGroups;

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
  const previousHex = bytesToHex(output.previousIdentifier);
  const nextHex = bytesToHex(output.identifier);
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
  const identifierHex = bytesToHex(output.identifier);
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
  if (!bytesEqual(address.groupHandle, group.groupHandle)) {
    throw new Error(
      "External address groupHandle copy does not match the group's canonical handle",
    );
  }
  return {
    contactName: group.contactName,
    scope: address.scope,
    identifier: hexToBytes(address.address),
    groupHandle: group.groupHandle,
    hmacProof: group.hmacProof,
    hmacRest: address.hmacRest,
    blockchainFamily: address.blockchainFamily,
    chainId: address.chainId,
  };
}

// --- serialization + storage ------------------------------------------------
//
// Uint8Array (hex) and bigint (decimal string) are not JSON-native, so the book
// is serialized through an explicit wire shape and restored on load.

type SerializedContactGroup = {
  id: string;
  contactName: string;
  groupHandle: string;
  hmacProof: string;
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
      groupHandle: bytesToHex(g.groupHandle),
      hmacProof: bytesToHex(g.hmacProof),
    })),
    externalAddresses: book.externalAddresses.map((a) => ({
      id: a.id,
      contactGroupId: a.contactGroupId,
      groupHandle: bytesToHex(a.groupHandle),
      scope: a.scope,
      address: a.address,
      blockchainFamily: a.blockchainFamily,
      ...(a.chainId !== undefined ? { chainId: a.chainId.toString() } : {}),
      hmacRest: bytesToHex(a.hmacRest),
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
      groupHandle: hexToBytes(g.groupHandle),
      hmacProof: hexToBytes(g.hmacProof),
    })),
    externalAddresses: (raw.externalAddresses ?? []).map((a) => ({
      id: a.id,
      contactGroupId: a.contactGroupId,
      groupHandle: hexToBytes(a.groupHandle),
      scope: a.scope,
      address: a.address,
      blockchainFamily: a.blockchainFamily,
      chainId: a.chainId !== undefined ? BigInt(a.chainId) : undefined,
      hmacRest: hexToBytes(a.hmacRest),
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

export function saveAddressBook(book: AddressBook): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    ADDRESS_BOOK_STORAGE_KEY,
    JSON.stringify(serializeAddressBook(book)),
  );
}

export function clearAddressBook(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ADDRESS_BOOK_STORAGE_KEY);
}
