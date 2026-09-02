import { type EvmAddressBook } from "@ledgerhq/device-signer-kit-ethereum";

/**
 * Domain model representing the configuration for the signer service
 */
export type SignerConfig = {
  originToken: string;
  blindSigningEnabled: boolean;
  /**
   * Bound to the signer at build time, from `--address-book`. Absent means the
   * signer gets no address book at all, the pre-contacts behaviour.
   */
  addressBook?: EvmAddressBook;
};
