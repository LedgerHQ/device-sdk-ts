import {
  emptyWallet,
  type Wallet,
  WALLET_SCHEMA_VERSION,
} from "@ledgerhq/device-management-kit";

/**
 * Reused as the slice's state shape so persistence round-trips cleanly
 * to/from the playground's `.contacts_wallet.json`.
 */
export type ContactsState = Wallet;

export const STORAGE_KEY = "dmk-sample-contacts-state";

export const initialState: ContactsState = emptyWallet();

export const SCHEMA_VERSION = WALLET_SCHEMA_VERSION;
