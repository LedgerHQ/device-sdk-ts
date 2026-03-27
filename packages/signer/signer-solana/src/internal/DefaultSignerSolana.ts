import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOption";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type SolanaTransactionOptionalConfig } from "@api/model/SolanaTransactionOptionalConfig";
import { type Transaction } from "@api/model/Transaction";
import { type SignerSolana } from "@api/SignerSolana";

import { type GetAddressUseCase } from "./use-cases/address/GetAddressUseCase";
import { type GetAppConfigurationUseCase } from "./use-cases/app-configuration/GetAppConfigurationUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";
import { type SignMessageUseCase } from "./use-cases/message/SignMessageUseCase";
import { type SignTransactionUseCase } from "./use-cases/transaction/SignTransactionUseCase";
import { makeContainer } from "./di";

export type DefaultSignerSolanaConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
};


export class DefaultSignerSolana implements SignerSolana {
  private _container: Container;

  constructor({
    dmk,
    sessionId,
    contextModule,
  }: DefaultSignerSolanaConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId, contextModule });
  }

  /**
   * Securely sign a Solana or SPL transaction using **clear signing** on Ledger devices.
   *
   * ### Parameters
   *
   * **Required**
   * - **derivationPath** `string`
   *   The derivation path used in the transaction (e.g. `"44'/501'/0'/0'"`).
   *
   * - **transaction** `Uint8Array`
   *   The serialised transaction to sign.
   *
   * **Optional**
   * - **solanaTransactionOptionalConfig** `SolanaTransactionOptionalConfig`
   *   Provides additional context for transaction signing. The
   *   `transactionResolutionContext` is not required — the signer will attempt
   *   to resolve metadata from the transaction itself. Explicitly providing it
   *   is recommended when the information is available, as it removes ambiguity
   *   and ensures accurate clear-signing details on the device.
   *
   *   - **transactionResolutionContext** `object`
   *     Lets you explicitly pass `tokenAddress` and ATA details, bypassing
   *     extraction from the transaction itself.
   *
   *     - **tokenAddress** `string`
   *       SPL token address being transferred.
   *
   *     - **createATA** `object`
   *       Information about creating an associated token account (ATA).
   *
   *       - **address** `string` – Address (owner) of the ATA.
   *       - **mintAddress** `string` – Mint address of the ATA.
   *
   *     - **tokenInternalId** `string`
   *       Ledger internal token ID.
   *
   *   - **skipOpenApp** `boolean`
   *     If `true`, skips opening the Solana app on the device.
   *
   * ### Returns
   *
   * `{ observable, cancel }` where:
   * - `observable` emits `DeviceActionState<Uint8Array, SignTransactionDAError, IntermediateValue>` updates.
   *   On **Completed**, `output` is a `Uint8Array` containing the 64-byte Ed25519 signature.
   * - `cancel` aborts the action on the Ledger device.
   *
   * @example
   * ```ts
   * const { observable } = signer.signTransaction("44'/501'/0'/0'", serializedTx, {
   *   transactionResolutionContext: { tokenAddress: "EPjFWdd5..." },
   * });
   * observable.subscribe({
   *   next: (state) => {
   *     if (state.status === DeviceActionStatus.Completed) {
   *       console.log("Signature:", state.output); // Uint8Array
   *     }
   *   },
   * });
   * ```
   */
  signTransaction(
    derivationPath: string,
    transaction: Transaction,
    solanaTransactionOptionalConfig?: SolanaTransactionOptionalConfig,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(useCasesTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, solanaTransactionOptionalConfig);
  }

  /**
   * Sign a Solana off-chain message on the device.
   *
   * Supports multiple signing modes via `SignMessageVersion`:
   * - **V0** (default) — original header with `appDomain`, up to 65 515 bytes.
   *   Falls back to Legacy on `6a81`.
   * - **V1** — simplified header, up to 65 535 bytes. Falls back to V0 then
   *   Legacy on `6a81`. Requires Solana device app version 1.14+.
   * - **Legacy** — compact header for backward compatibility with old Solana app firmware.
   * - **Raw** — pass-through: sends a caller-formatted `Uint8Array` payload
   *   as-is, no header wrapping.
   *
   * ### Parameters
   *
   * **Required**
   * - **derivationPath** `string`
   *   The derivation path used for signing (e.g. `"44'/501'/0'"`).
   *
   * - **message** `string | Uint8Array`
   *   The message to sign. Pass a `string` for V0/V1/Legacy (UTF-8 encoded
   *   automatically). Pass a `Uint8Array` for Raw mode when you have an
   *   already-formatted binary payload.
   *
   * **Optional**
   * - **options** `MessageOptions`
   *   - **skipOpenApp** `boolean`
   *     If `true`, skips opening the Solana app on the device.
   *   - **version** `SignMessageVersion`
   *     Off-chain message signing mode. Defaults to `SignMessageVersion.V0`.
   *   - **appDomain** `string`
   *     V0 only: application domain included in the header (padded/truncated to 32 bytes).
   *     Ignored for V1, Legacy, and Raw.
   *
   * ### Returns
   *
   * `{ observable, cancel }` where:
   * - `observable` emits `DeviceActionState<{ signature: string }, SignMessageDAError, IntermediateValue>` updates.
   *   On **Completed**, `output.signature` is a base58-encoded string — a full
   *   envelope (V0/V1/Legacy) or the plain Ed25519 signature (Raw).
   * - `cancel` aborts the action on the Ledger device.
   *
   * @example
   * ```ts
   * const { observable } = signer.signMessage("44'/501'/0'", "Hello World", {
   *   version: SignMessageVersion.V0,
   * });
   * observable.subscribe({
   *   next: (state) => {
   *     if (state.status === DeviceActionStatus.Completed) {
   *       console.log("Signature:", state.output.signature); // base58 string
   *     }
   *   },
   * });
   * ```
   */
  signMessage(
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ): SignMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(useCasesTypes.SignMessageUseCase)
      .execute(derivationPath, message, options);
  }

  /**
   * Derive and optionally display a Solana address on the device.
   *
   * ### Parameters
   *
   * **Required**
   * - **derivationPath** `string`
   *   The derivation path of the account to retrieve the address from
   *   (e.g. `"44'/501'/0'"`).
   *
   * **Optional**
   * - **options** `AddressOptions`
   *   - **checkOnDevice** `boolean`
   *     If `true`, prompts the user to verify the address on the device.
   *   - **skipOpenApp** `boolean`
   *     If `true`, skips opening the Solana app on the device.
   *
   * ### Returns
   *
   * `{ observable, cancel }` where:
   * - `observable` emits `DeviceActionState<{ publicKey: string }, GetAddressDAError, IntermediateValue>` updates.
   *   On **Completed**, `output.publicKey` is the base58-encoded Solana address.
   * - `cancel` aborts the action on the Ledger device.
   *
   * @example
   * ```ts
   * const { observable } = signer.getAddress("44'/501'/0'", { checkOnDevice: true });
   * observable.subscribe({
   *   next: (state) => {
   *     if (state.status === DeviceActionStatus.Completed) {
   *       console.log("Address:", state.output.publicKey); // base58 string
   *     }
   *   },
   * });
   * ```
   */
  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(useCasesTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }

  /**
   * Query the Solana app version and settings on the connected device.
   *
   * ### Parameters
   *
   * This method does not require any parameters.
   *
   * ### Returns
   *
   * `{ observable, cancel }` where:
   * - `observable` emits `DeviceActionState<AppConfiguration, GetAppConfigurationDAError, IntermediateValue>` updates.
   *   On **Completed**, `output` contains:
   *   - `blindSigningEnabled` `boolean` — whether blind signing is enabled.
   *   - `pubKeyDisplayMode` `PublicKeyDisplayMode` — how the public key is displayed.
   *   - `version` `string` — the Solana app version (e.g. `"1.14.0"`).
   * - `cancel` aborts the action on the Ledger device.
   *
   * @example
   * ```ts
   * const { observable } = signer.getAppConfiguration();
   * observable.subscribe({
   *   next: (state) => {
   *     if (state.status === DeviceActionStatus.Completed) {
   *       console.log(`Solana app v${state.output.version}`);
   *     }
   *   },
   * });
   * ```
   */
  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return this._container
      .get<GetAppConfigurationUseCase>(useCasesTypes.GetAppConfigurationUseCase)
      .execute();
  }
}
