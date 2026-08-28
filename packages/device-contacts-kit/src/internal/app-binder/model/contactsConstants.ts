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

/**
 * EDIT CONTACT NAME (rename) is a blockchain-agnostic OS/dashboard command with
 * its own CLA/INS — NOT a sub-command of the address-book app APDU (0xB0/0x10).
 * The OS serves it directly, so it must run on the dashboard. P1 is a fixed
 * 0x00 (there is no sub-command selector for this command); P2 still carries the
 * chunk-continuation flag handled by {@link ./../services/sendFramedContactsPayload}.
 */
export const RENAME_CONTACT_APDU_CLA = 0xe0;
export const RENAME_CONTACT_APDU_INS = 0x2e;
export const RENAME_CONTACT_P1 = 0x00;

/** Sizes (bytes) of the fields in the REGISTER IDENTITY final-chunk response. */
export const GROUP_HANDLE_BYTES = 64;
export const HMAC_PROOF_BYTES = 32;
export const HMAC_REST_BYTES = 32;

/**
 * Size (bytes) of the rotated `hmac_name` returned on the EDIT CONTACT NAME
 * final-chunk response — the replacement group-level name proof.
 */
export const HMAC_NAME_BYTES = 32;

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
