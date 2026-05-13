import { type EditExternalAddressDAReturnType } from "@api/app-binder/EditExternalAddressDeviceActionTypes";
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type ProvideContactDAReturnType } from "@api/app-binder/ProvideContactDeviceActionTypes";
import { type ProvideLedgerAccountDAReturnType } from "@api/app-binder/ProvideLedgerAccountDeviceActionTypes";
import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RegisterLedgerAccountDAReturnType } from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import { type SignDelegationAuthorizationDAReturnType } from "@api/app-binder/SignDelegationAuthorizationTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type VerifySafeAddressDAReturnType } from "@api/app-binder/VerifySafeAddressDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type EditExternalAddressArgs } from "@api/model/EditExternalAddressArgs";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type ProvideContactArgs } from "@api/model/ProvideContactArgs";
import { type ProvideLedgerAccountArgs } from "@api/model/ProvideLedgerAccountArgs";
import { type RegisterExternalAddressArgs } from "@api/model/RegisterExternalAddressArgs";
import { type RegisterLedgerAccountArgs } from "@api/model/RegisterLedgerAccountArgs";
import { type SafeAddressOptions } from "@api/model/SafeAddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TypedData } from "@api/model/TypedData";
import { type TypedDataOptions } from "@api/model/TypedDataOptions";

export interface SignerEth {
  /**
   * Sign an Ethereum transaction. ContextModule loaders (ENS,
   * ERC-7730, web3-check, token / NFT info, …) are gathered and pushed
   * automatically before the SignTx APDU.
   *
   * NOTE: Contacts metadata is NOT yet part of that unified pipeline.
   * Callers that want From / To decoration must invoke
   * `provideLedgerAccount` and/or `provideContact` BEFORE this call.
   * Integrating Contacts into ContextModule (new
   * `ContactsContextLoader` + `ClearSignContextType.CONTACT_*` branches
   * in `ProvideContextTask`) is tracked separately — see `<TICKET-ID>`.
   */
  signTransaction: (
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ) => SignTransactionDAReturnType;
  signMessage: (
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ) => SignPersonalMessageDAReturnType;
  signTypedData: (
    derivationPath: string,
    typedData: TypedData,
    options?: TypedDataOptions,
  ) => SignTypedDataDAReturnType;
  getAddress: (
    derivationPath: string,
    options?: AddressOptions,
  ) => GetAddressDAReturnType;
  verifySafeAddress: (
    safeContractAddress: string,
    options?: SafeAddressOptions,
  ) => VerifySafeAddressDAReturnType;
  signDelegationAuthorization: (
    derivationPath: string,
    chainId: number,
    contractAddress: string,
    nonce: number,
  ) => SignDelegationAuthorizationDAReturnType;
  registerExternalAddress: (
    args: RegisterExternalAddressArgs,
  ) => RegisterExternalAddressDAReturnType;
  editExternalAddress: (
    args: EditExternalAddressArgs,
  ) => EditExternalAddressDAReturnType;
  registerLedgerAccount: (
    args: RegisterLedgerAccountArgs,
  ) => RegisterLedgerAccountDAReturnType;
  /**
   * Load a previously-registered Contact entry into the device so the
   * NEXT Sign review screen substitutes the friendly contact name for
   * the raw recipient address. Silent on device (no approval prompt) —
   * firmware trusts the HMAC chain authorised at Register time and
   * replies SW=0x9000 + empty data.
   *
   * **Orchestration contract (callers — including Live B2 — must
   * honour):**
   * - Call this BEFORE `signTransaction` for the same recipient.
   * - The Provided friendly name sits in firmware memory until
   *   `app_quit`, so a single ETH-app session can chain multiple
   *   `provideContact` / `provideLedgerAccount` / `signTransaction`
   *   calls without losing decorations. The DMK `OpenAppDeviceAction`
   *   short-circuits when the requested app is already open, so the
   *   cache survives the next call's lifecycle.
   * - Safe to chain via observable `firstValueFrom(... filter(Completed
   *   || Error))` — see `apps/sample/.../SendToContactForm.tsx` for the
   *   reference orchestration.
   *
   * **Composability:** wire-orthogonal (CLA=0xb0) to all
   * ContextModule-driven clear-signing channels (tokens, NFTs,
   * trusted-name, ERC-7730 generic-parser, web3-checks — all CLA=0xe0).
   * One open question for B2 integrators: `provideContact` and
   * `ProvideTrustedName` (ENS) both decorate the on-device recipient
   * field. Firmware precedence is not yet documented; today, only emit
   * one of the two per Send, or wait for the upstream-asks resolution
   * tracked in
   * `~/dev/ledger-contacts-playground/docs/upstream-asks.md`.
   *
   * This method exists because Contacts is not yet integrated into the
   * ContextModule unified loader pipeline. Once it is (see
   * `signTransaction` JSDoc), this surface becomes optional /
   * advanced-use rather than the required orchestration step.
   */
  provideContact: (args: ProvideContactArgs) => ProvideContactDAReturnType;
  /**
   * Load a previously-registered Ledger account into the device so the
   * NEXT Sign review screen substitutes the account name for the
   * derived address. Used for both From-side decoration (the sender's
   * known account) and To-side decoration when the recipient is itself
   * a Ledger account. Silent on device.
   *
   * Same orchestration contract as `provideContact`: call BEFORE
   * `signTransaction`; safe to chain on the same ETH-app session; uses
   * CLA=0xb0 so it composes cleanly with the ContextModule channels.
   * The device derives the address from `derivationPath` internally —
   * the caller never sends `addressHex`.
   *
   * Naming note: the upstream Python client calls this op
   * `provide_ledger_account_contact`. The TS surface drops the trailing
   * `Contact` to keep `contact` reserved for external-address holders
   * (mirrors DMK's `contacts: {...}` vs `accounts: {...}` Wallet split).
   * The wire fixture key in `apdu-traces.json` stays the Python name —
   * that's the byte-parity source of truth.
   *
   * Same status as `provideContact`: this method exists because
   * Contacts is not yet integrated into the ContextModule pipeline (see
   * `signTransaction` JSDoc). Once it is, the loader will resolve known
   * From / To accounts automatically and callers will no longer need to
   * invoke this explicitly.
   */
  provideLedgerAccount: (
    args: ProvideLedgerAccountArgs,
  ) => ProvideLedgerAccountDAReturnType;
}
