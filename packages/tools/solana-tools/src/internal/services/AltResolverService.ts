import {
  type AddressLookupTableAccount,
  type VersionedMessage,
} from "@solana/web3.js";

export interface AltResolverService {
  /**
   * Fetch the full lookup tables referenced by a v0 message, not just the
   * subset of addresses a transaction happens to use.
   *
   * Legacy and no-ALT messages resolve to an empty array. Throws when a
   * referenced table is missing or closed (the underlying lookup returns null),
   * which is not recoverable.
   */
  resolveAddressLookupTables(
    message: VersionedMessage,
    rpcUrl?: string,
  ): Promise<AddressLookupTableAccount[]>;
}
