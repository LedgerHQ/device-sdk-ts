/**
 * A complete snapshot of the EVM-compatible part of the address book.
 *
 * The signer never mutates this snapshot and never persists it: owning,
 * updating and persisting the address book remains the host's responsibility.
 *
 * Only EVM-family contacts and accounts belong here. The host filters by
 * blockchain family while building the snapshot, so the signer's in-flow
 * matching never needs a family discriminator and the models below do not
 * carry one.
 */
export type EvmAddressBook = {
  contactGroups: readonly EvmContactGroup[];
  ledgerAccounts: readonly EvmLedgerAccountContact[];
};

/**
 * A named contact and the external addresses registered under it.
 *
 * The group carries the name-level proof material that every one of its
 * addresses reuses, so matching an address always yields its group without a
 * lookup.
 */
export type EvmContactGroup = {
  contactName: string;
  groupHandle: Uint8Array;
  hmacProof: Uint8Array;
  externalAddresses: readonly EvmExternalAddress[];
};

/**
 * An external address registered under a contact group, for one chain.
 *
 * The derivation path used at registration time is deliberately absent: the
 * signer never needs it to provide the contact to the device.
 */
export type EvmExternalAddress = {
  scope: string;
  address: `0x${string}`;
  chainId: bigint;
  hmacRest: Uint8Array;
};

/**
 * A named Ledger account contact, identified by its derivation path and chain
 * rather than by an address string.
 */
export type EvmLedgerAccountContact = {
  accountName: string;
  derivationPath: string;
  chainId: bigint;
  hmacProof: Uint8Array;
};

/**
 * The book bound when the host supplies none. Matches nothing.
 *
 * Frozen because it is a process-wide singleton: it is the DI binding, the
 * device-action default and the fixture every test reuses, so a single stray
 * mutation would leak into every signer at once.
 */
export const EMPTY_EVM_ADDRESS_BOOK: EvmAddressBook = Object.freeze({
  contactGroups: Object.freeze([]),
  ledgerAccounts: Object.freeze([]),
});
