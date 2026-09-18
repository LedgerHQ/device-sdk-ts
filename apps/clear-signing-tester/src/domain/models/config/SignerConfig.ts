import { type EvmAddressBook } from "@ledgerhq/device-signer-kit-ethereum";
import { type TronAddressBook } from "@ledgerhq/device-signer-kit-tron";

/**
 * Domain model representing the configuration for the signer service
 */
export type SignerConfig = {
  originToken: string;
  blindSigningEnabled: boolean;
  /**
   * Bound to the signer at build time, from a scenario's `addressBook` option.
   * Absent means the signer gets no address book at all, the pre-contacts
   * behaviour.
   */
  addressBook?: EvmAddressBook;
  tronAddressBook?: TronAddressBook;
};
