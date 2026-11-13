import { type EvmAddressBook } from "@ledgerhq/device-signer-kit-ethereum";
import { type TronAddressBook } from "@ledgerhq/device-signer-kit-tron";

/**
 * Domain model representing the configuration for the signer service
 */
export type SignerConfig = {
  originToken: string;
  blindSigningEnabled: boolean;
  /**
   * Accept the Transaction Check opt-in and require every review to show a
   * verdict, from a scenario's `transactionCheckEnabled` option. Off declines
   * the opt-in, as before.
   */
  transactionCheckEnabled: boolean;
  /**
   * Bound to the signer at build time, from a scenario's `addressBook` option.
   * Absent means the signer gets no address book at all, the pre-contacts
   * behaviour.
   */
  addressBook?: EvmAddressBook;
  tronAddressBook?: TronAddressBook;
};
