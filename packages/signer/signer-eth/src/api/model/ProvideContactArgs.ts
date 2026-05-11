/**
 * Arguments for `SignerEth.provideContact` — runtime op that loads a
 * previously-registered Contact entry into the device so the next Sign
 * review screen substitutes the friendly name for the raw address.
 *
 * Silent on device (no user prompt): firmware trusts the HMAC chain
 * authorised at Register time and replies with SW=0x9000 + empty data.
 * The form/caller is responsible for sequencing this before a Sign call
 * and for picking the right `provide*` variant (this one for external-
 * address holders; `provideLedgerAccount` for Ledger accounts).
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
