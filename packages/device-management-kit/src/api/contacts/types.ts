/**
 * Typed data model for the Contacts wallet — TS port of
 * `~/dev/ledger-contacts-playground/src/ledger_contacts/types.py`.
 *
 * Field names mirror the Python source (camelCased) so the JSON shape
 * persisted in localStorage stays trivially translatable to/from the
 * playground's `.contacts_wallet.json`. Bump `WALLET_SCHEMA_VERSION`
 * if you change the shape and add a one-shot migration.
 *
 * Cross-chain by design: this lives in DMK core because the same
 * Contact record can carry entries from multiple coins (ETH today,
 * SOL next). Coin-specific persistence belongs in coin-signer
 * packages, not here.
 */
export const WALLET_SCHEMA_VERSION = 1 as const;

/**
 * Mirrors `AddressBookResponseType` in the upstream Python client
 * (`app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py`).
 * Single source of truth for the response-discriminator byte the
 * device prepends to RAPDU data on success.
 */
export enum ResponseType {
  RegisterIdentity = 0x2d,
  EditContactName = 0x2e,
  RegisterLedgerAccount = 0x2f,
  EditLedgerAccount = 0x30,
  EditIdentifier = 0x31,
  EditScope = 0x32,
  ProvideContact = 0x33,
  ProvideLedgerAccountContact = 0x34,
}

/**
 * One address bound to a Contact. A Contact may carry several entries
 * (different chains, scopes, or labels). Per-entry HMAC over
 * `(gid | scope | identifier | family | chain_id)` lives in
 * `hmacRestHex` and rotates on Edit-external-address /
 * Edit-external-address-label.
 */
export interface ContactEntry {
  network: string;
  chainId: number;
  /** 20-byte ETH address as 40 lowercase hex chars, no 0x prefix. */
  addressHex: string;
  /** User-visible label that disambiguates entries within a Contact. */
  scope: string;
  /** BIP32 path of the Contact owner's account (see HMAC chain notes in service.py). */
  derivationPath: string;
  /** 32-byte HMAC over the entry's identifier+scope tuple. Hex. */
  hmacRestHex: string;
  /** Last device response that produced/refreshed this entry. */
  lastResponseType?: ResponseType;
}

/**
 * A named Contact (cross-chain). `groupHandleHex` is the immutable
 * device-side identity issued at first Register; `hmacNameHex` rotates
 * on Rename-Contact and is invariant across the entries.
 */
export interface Contact {
  name: string;
  /** 64-byte group handle = gid(32) | MAC(K_group, gid)(32). Hex. */
  groupHandleHex: string;
  /** 32-byte HMAC over `(gid, name)`. Rotates on Rename Contact. Hex. */
  hmacNameHex: string;
  entries: ContactEntry[];
}

/**
 * A signer-controlled Ledger account registered with the device.
 * ETH-coupled today (BIP32 path + chainId derive an ETH address); SOL
 * will get its own analogous shape when signer-sol adopts Contacts.
 */
export interface Account {
  name: string;
  derivationPath: string;
  chainId: number;
  /** 32-byte HMAC over `(account_id, account_name)`. Rotates on rename. Hex. */
  hmacProofHex: string;
  /** Cached 20-byte address (no 0x), populated post-Register via get_public_addr. */
  addressHex?: string;
  lastResponseType?: ResponseType;
}

/**
 * Top-level wallet shape persisted to localStorage in apps/sample.
 * Suggested storage key: `dmk-sample-contacts-state`.
 */
export interface Wallet {
  schemaVersion: typeof WALLET_SCHEMA_VERSION;
  contacts: Record<string, Contact>;
  accounts: Record<string, Account>;
}

export const emptyWallet = (): Wallet => ({
  schemaVersion: WALLET_SCHEMA_VERSION,
  contacts: {},
  accounts: {},
});
