/**
 * Internal-only arg shape consumed by `SendProvideContactTask` (the
 * wire-layer task that builds the TLV payload and frames the
 * `provide_contact` APDU). Reached from `ProvideContextTask` when the
 * `ContactsContextLoader` emits a `CONTACT_EXTERNAL` clear-sign
 * context for the recipient.
 *
 * Field shapes mirror the Contact/ContactEntry shape from DMK core's
 * `api/contacts/types.ts`: `groupHandleHex` is the contact-level 64-byte
 * group handle, `hmacNameHex` is the contact-level `hmac_name` (32 B,
 * the device names this "HMAC_PROOF" on the wire), `hmacRestHex` is
 * the per-entry rotating HMAC (32 B).
 */
export type ProvideContactArgs = {
  readonly contactName: string;
  readonly scope: string;
  readonly addressHex: string;
  readonly groupHandleHex: string;
  readonly hmacNameHex: string;
  readonly hmacRestHex: string;
  readonly derivationPath: string;
  readonly chainId: number;
};

/**
 * Device returns SW=0x9000 with no payload on success — the value of a
 * successful Provide is the side-effect (device caches the friendly
 * name for the next Sign review), not a returned field. The Result
 * type is intentionally empty but typed so the `CommandResult<Result,
 * EthErrorCodes>` chain stays well-formed end-to-end.
 */
export type ProvideContactResult = Record<string, never>;
