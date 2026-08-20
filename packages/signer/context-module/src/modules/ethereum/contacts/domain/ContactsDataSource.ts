/**
 * Pluggable port for the Contacts metadata channel.
 *
 * Unlike ENS / ERC-7730 / web3-check (which fetch from remote
 * services), the Contacts list is local-first: the SDK consumer
 * holds it (Redux store, native keystore, etc.) and injects an
 * adapter at `ContextModuleBuilder.setContactsDataSource(...)` time.
 * The `ContactsContextLoader` queries this port during
 * `ContextModule.getContexts(tx)` and emits zero, one or two
 * `ClearSignContext` entries depending on which sides of `tx` are
 * known.
 *
 * Two methods, not one, because the from-side can only ever match a
 * Ledger-account decoration (the SDK consumer signs *as* a Ledger
 * account), whereas the to-side can be either an external contact or
 * a different Ledger account in the same wallet.
 */

export type ContactExternalDecoration = {
  readonly contactName: string;
  readonly scope: string;
  readonly addressHex: string;
  readonly groupHandleHex: string;
  readonly hmacNameHex: string;
  readonly hmacRestHex: string;
  readonly derivationPath: string;
  readonly chainId: number;
};

export type ContactLedgerAccountDecoration = {
  readonly accountName: string;
  readonly hmacProofHex: string;
  readonly derivationPath: string;
  readonly chainId: number;
};

export type ContactDecoration =
  | ({ readonly kind: "external" } & ContactExternalDecoration)
  | ({ readonly kind: "ledgerAccount" } & ContactLedgerAccountDecoration);

export type ContactsLookupKey = {
  readonly address: string;
  readonly chainId: number;
};

export interface ContactsDataSource {
  lookupFrom(
    key: ContactsLookupKey,
  ): Promise<ContactLedgerAccountDecoration | null>;

  lookupTo(key: ContactsLookupKey): Promise<ContactDecoration | null>;
}
