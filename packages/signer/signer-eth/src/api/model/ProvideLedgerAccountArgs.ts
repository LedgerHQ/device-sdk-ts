/**
 * Arguments for `SignerEth.provideLedgerAccount` — runtime op that
 * loads a previously-registered Ledger account into the device so the
 * next Sign review screen substitutes the account name for the raw
 * derived address. Used for both the sender (From) decoration and the
 * recipient (To) decoration when the recipient is a Ledger account.
 *
 * Silent on device (no user prompt): firmware trusts the HMAC chain
 * authorised at Register time (op 5) and replies with SW=0x9000 +
 * empty data. The device re-derives the address from `derivationPath`
 * internally — we do NOT send `addressHex`.
 *
 * Note: the Python op is named `provide_ledger_account_contact` in the
 * upstream client. We drop the "Contact" suffix on the TS side to keep
 * the `contact` term reserved for external-address holders (matches
 * the `contacts: {...}` vs `accounts: {...}` split in DMK core's
 * Wallet shape and the M6 `RegisterLedgerAccount` naming). The
 * playground fixture key `provide_ledger_account_contact_*` is the
 * byte-parity source of truth.
 */
export type ProvideLedgerAccountArgs = {
  readonly accountName: string;
  readonly hmacProofHex: string;
  readonly derivationPath: string;
  readonly chainId: number;
};

/**
 * Device returns SW=0x9000 with no payload on success. See
 * `ProvideContactResult` for the rationale of the empty Result type.
 */
export type ProvideLedgerAccountResult = Record<string, never>;
