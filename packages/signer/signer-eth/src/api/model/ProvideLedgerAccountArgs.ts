/**
 * Internal-only arg shape consumed by `SendProvideLedgerAccountTask`
 * (the wire-layer task that builds the TLV payload and frames the
 * `provide_ledger_account_contact` APDU). Reached from
 * `ProvideContextTask` when the `ContactsContextLoader` emits a
 * `CONTACT_LEDGER_ACCOUNT` clear-sign context for either the from-side
 * sender or a to-side Ledger-account recipient.
 *
 * The device re-derives the address from `derivationPath` internally —
 * we do NOT send `addressHex`.
 *
 * Naming note: the firmware op is `provide_ledger_account_contact`.
 * The TS surface drops the trailing `Contact` to keep `contact`
 * reserved for external-address holders (mirrors DMK's
 * `contacts: {...}` vs `accounts: {...}` Wallet split).
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
