/**
 * A complete snapshot of the Tron-compatible part of the address book.
 *
 * The signer never mutates this snapshot and never persists it: owning,
 * updating and persisting the address book remains the host's responsibility.
 *
 * Only Tron-family contacts and accounts belong here. The host filters by
 * blockchain family while building the snapshot, so the signer's in-flow
 * matching never needs a family discriminator and the models below do not
 * carry one.
 *
 * The Tron models carry no chain id: the firmware specification only includes
 * one for Ethereum.
 */
export type TronAddressBook = {
  contactGroups: TronContactGroup[];
  ledgerAccounts: TronLedgerAccountContact[];
};

/**
 * A named contact and the external addresses registered under it.
 *
 * The group carries the name-level proof material that every one of its
 * addresses reuses, so matching an address always yields its group without a
 * lookup.
 */
export type TronContactGroup = {
  contactName: string;
  groupHandle: Uint8Array;
  hmacProof: Uint8Array;
  externalAddresses: TronExternalAddress[];
};

/**
 * An external address registered under a contact group.
 *
 * The address is a base58 Tron address. The derivation path used at
 * registration time is deliberately absent: the signer never needs it to
 * provide the contact to the device.
 */
export type TronExternalAddress = {
  scope: string;
  address: string;
  hmacRest: Uint8Array;
};

/**
 * A named Ledger account contact, identified by its derivation path rather
 * than by an address string.
 */
export type TronLedgerAccountContact = {
  accountName: string;
  derivationPath: string;
  hmacProof: Uint8Array;
};
