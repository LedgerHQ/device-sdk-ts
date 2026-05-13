---
"@ledgerhq/device-signer-kit-ethereum": major
"@ledgerhq/context-module": minor
---

Integrate Contacts metadata into the unified ContextModule pipeline:
`signTransaction` now auto-pushes the `provide_contact` /
`provide_ledger_account_contact` APDUs for any known from / to
addresses, the same way it already auto-pushes ENS, ERC-7730 and
web3-check decorations. Contacts wins over TRUSTED_NAME on collision.

`context-module` (minor):
- New `ClearSignContextType.CONTACT_EXTERNAL` and
  `ClearSignContextType.CONTACT_LEDGER_ACCOUNT` enum variants on the
  public `ClearSignContextType` enum. Downstream consumers doing
  exhaustive switches on this enum will need to handle the new cases.
- New `ContactsDataSource` port: SDK consumers register a contacts
  store via `new ContextModuleBuilder(...).setContactsDataSource(adapter)`.
  Contacts is local-first; there is no default implementation, and
  not registering a data source keeps the existing no-Contacts
  behaviour exactly as it was.

`device-signer-kit-ethereum` (major, BREAKING):
- Removed `SignerEth.provideContact` and `SignerEth.provideLedgerAccount`
  from the public API. Callers that were chaining these before
  `signTransaction` should register a `ContactsDataSource` on the
  `ContextModuleBuilder` instead — the SDK will then push the same
  APDUs automatically.
- The `ProvideContact*` and `ProvideLedgerAccount*` device-action and
  return-type exports are gone with the methods.
- `RegisterExternalAddress`, `EditExternalAddress`, and
  `RegisterLedgerAccount` are unchanged — they remain explicit setup
  operations on the public API.
