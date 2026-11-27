/**
 * A complete snapshot of the Solana-compatible part of the address book.
 *
 * The signer never mutates this snapshot and never persists it: owning,
 * updating and persisting the address book remains the host's responsibility.
 *
 * Only Solana-family contacts and accounts belong here. The host filters by
 * blockchain family while building the snapshot, so the signer's in-flow
 * matching never needs a family discriminator and the models below do not
 * carry one.
 *
 * The Solana models carry no chain id: the firmware specification only
 * includes one for Ethereum.
 */
export type SolanaAddressBook = {
  contactGroups: readonly SolanaContactGroup[];
  ledgerAccounts: readonly SolanaLedgerAccountContact[];
};

/**
 * A named contact and the external addresses registered under it.
 *
 * The group carries the name-level proof material that every one of its
 * addresses reuses, so matching an address always yields its group without a
 * lookup.
 */
export type SolanaContactGroup = {
  contactName: string;
  groupHandle: Uint8Array;
  hmacProof: Uint8Array;
  externalAddresses: readonly SolanaExternalAddress[];
};

/**
 * An external address registered under a contact group.
 *
 * The address is the base58 wallet public key, never a token account: the
 * signer derives the associated token accounts itself when it matches a token
 * transfer. The derivation path used at registration time is deliberately
 * absent: the signer never needs it to provide the contact to the device.
 */
export type SolanaExternalAddress = {
  scope: string;
  address: string;
  hmacRest: Uint8Array;
};

/**
 * A named Ledger account contact, identified by its derivation path rather
 * than by an address string.
 */
export type SolanaLedgerAccountContact = {
  accountName: string;
  derivationPath: string;
  hmacProof: Uint8Array;
};

/**
 * The book bound when the host supplies none. Matches nothing, and is frozen
 * because every signer in the process shares this one instance.
 */
export const EMPTY_SOLANA_ADDRESS_BOOK: SolanaAddressBook = Object.freeze({
  contactGroups: Object.freeze([]),
  ledgerAccounts: Object.freeze([]),
});
