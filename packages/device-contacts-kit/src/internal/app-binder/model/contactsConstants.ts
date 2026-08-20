/**
 * Protocol constants shared by the Contacts (Address Book) operations.
 *
 * Wire format and values follow the BOLOS SDK Address Book specification
 * (ledger-secure-sdk/app_features/address_book). Op-specific sub-command bytes
 * and response field sizes live here; TLV tags and struct-type bytes live in
 * {@link ./../services/contactsTlvSerializer}.
 */

/** APDU class/instruction shared by every Address Book sub-command. */
export const CONTACTS_APDU_CLA = 0xb0;
export const CONTACTS_APDU_INS = 0x10;

/** P1 sub-command selector for REGISTER IDENTITY (register external address). */
export const SUB_CMD_REGISTER_IDENTITY = 0x01;

/** P1 sub-command selector for REGISTER LEDGER ACCOUNT. */
export const SUB_CMD_REGISTER_LEDGER_ACCOUNT = 0x11;

/** Sizes (bytes) of the fields in the REGISTER IDENTITY final-chunk response. */
export const GROUP_HANDLE_BYTES = 64;
export const HMAC_PROOF_BYTES = 32;
export const HMAC_REST_BYTES = 32;

/**
 * Blockchain-family byte encoded in the `BLOCKCHAIN_FAMILY` TLV, keyed by a
 * lowercase family name. v1 ships Ethereum only; the remaining families are
 * listed for completeness and will be enabled as their chains are supported.
 */
export const BLOCKCHAIN_FAMILY_BY_NAME: Readonly<Record<string, number>> = {
  bitcoin: 0x00,
  ethereum: 0x01,
  solana: 0x02,
  polkadot: 0x03,
  cosmos: 0x04,
  cardano: 0x05,
};
