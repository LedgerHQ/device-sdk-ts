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
   * ## signTransaction
   * #### Securely sign a Solana or SPL transaction using **clear signing** on Ledger devices.
   * ---
   * ### Parameters
   *
   * **Required**
   * - **derivationPath** `string`
   *   The derivation path used in the transaction.
   *
   * - **transaction** `Uint8Array`
   *   The serialised transaction to sign.
   *
   * **Optional**
   * - **options** `SolanaTransactionOptionalConfig`
   *   Provides additional context for transaction signing.
   *
   *   - **transactionResolutionContext** `object`
   *     Lets you explicitly pass `tokenAddress` and ATA details, bypassing extraction from the transaction itself.
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
   *       Ledger internal token ID
   *
   *   - **solanaRPCURL** `string`
   *     RPC endpoint to use if `transactionResolutionContext` is not provided
   *     and parsing requires network lookups.
   *     In browser environments, use a CORS-enabled RPC URL.
   *     Defaults to: `"https://api.mainnet-beta.solana.com/"`.
   *
   *   - **skipOpenApp** `boolean`
   *     If `true`, skips opening the Solana app on the device.
   *
   * ---
   * ### Returns
   *
   * - `observable` That emits DeviceActionState updates
   * - `cancel` A function to cancel the action on the Ledger device.
   *
   * ---
   * ### Internal Flow
   *
   * Under the hood, this method subscribes to an
   * `Observable<DeviceActionState<Uint8Array, SignTransactionDAError, IntermediateValue>>`.
   *
   * #### DeviceActionState
   * Represents the lifecycle of a device action:
   *
   * ```ts
   * type DeviceActionState<Output, Error, IntermediateValue> =
   *   | { status: DeviceActionStatus.NotStarted }
   *   | { status: DeviceActionStatus.Pending; intermediateValue: IntermediateValue }
   *   | { status: DeviceActionStatus.Stopped }
   *   | { status: DeviceActionStatus.Completed; output: Output }
   *   | { status: DeviceActionStatus.Error; error: Error };
   *
   * enum DeviceActionStatus {
   *   NotStarted = "not-started",
   *   Pending    = "pending",
   *   Stopped    = "stopped",
   *   Completed  = "completed",
   *   Error      = "error"
   * }
   * ```
   *
   * - **NotStarted** → Action hasn’t begun.
   * - **Pending** → Waiting for user confirmation on the device.
   *   Includes an `intermediateValue` of type `IntermediateValue`.
   * - **Stopped** → Action was cancelled before completion.
   * - **Completed** → Provides the signed transaction bytes (`Uint8Array`).
   * - **Error** → The device or signing operation failed (`SignTransactionDAError`).
   *
   * ---
   * ### Example
   *
   * ```ts
   * const { observable } = signerSolana.signTransaction("m/44'/501'/0'/0'", serializedTx, {
   *   transactionResolutionContext: resolution,
   * });
   * observable.subscribe({
   *   next: state => {
   *     if (state.status === DeviceActionStatus.Pending) {
   *       console.log("Waiting for user action...", state.intermediateValue);
   *     }
   *     if (state.status === DeviceActionStatus.Completed) {
   *       console.log("Signature:", state.output);
   *     }
   *   },
   *   error: err => console.error("Error:", err),
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
   * ## signMessage
   * #### Sign a Solana off-chain message on Ledger devices.
   *
   * Supports multiple signing modes via `SignMessageVersion`:
   * - **V0** (default) — original header with `appDomain`, up to 65 515 bytes. Falls back to Legacy on `6a81`.
   * - **V1** — simplified header, up to 65 535 bytes. Falls back to V0 -> Legacy on `6a81`. Not yet supported by released firmware.
   * - **Legacy** — compact header for backward compatibility with old Solana app firmware.
   * - **Raw** — pass-through: sends a caller-formatted `Uint8Array` payload as-is, no header wrapping.
   *
   * ---
   * ### Parameters
   *
   * **Required**
   * - **derivationPath** `string`
   *   The derivation path used for signing.
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
   * ---
   * ### Returns
   *
   * - `observable` That emits DeviceActionState updates
   * - `cancel` A function to cancel the action on the Ledger device.
   *
   * ---
   * ### Internal Flow
   *
   * Under the hood, this method subscribes to an
   * `Observable<DeviceActionState<{ signature: string }, SignMessageDAError, IntermediateValue>>`.
   *
   * #### DeviceActionState
   * Represents the lifecycle of a device action:
   *
   * ```ts
   * type DeviceActionState<Output, Error, IntermediateValue> =
   *   | { status: DeviceActionStatus.NotStarted }
   *   | { status: DeviceActionStatus.Pending; intermediateValue: IntermediateValue }
   *   | { status: DeviceActionStatus.Stopped }
   *   | { status: DeviceActionStatus.Completed; output: Output }
   *   | { status: DeviceActionStatus.Error; error: Error };
   *
   * enum DeviceActionStatus {
   *   NotStarted = "not-started",
   *   Pending    = "pending",
   *   Stopped    = "stopped",
   *   Completed  = "completed",
   *   Error      = "error"
   * }
   * ```
   *
   * - **NotStarted** → Action hasn’t begun.
   * - **Pending** → Waiting for user confirmation on the device.
   *   Includes an `intermediateValue` of type `IntermediateValue`.
   * - **Stopped** → Action was cancelled before completion.
   * - **Completed** → Provides `{ signature: string }` — a base58 envelope
   *   (V1/V0/Legacy) or a raw base58 signature (Raw).
   * - **Error** → The device or signing operation failed (`SignMessageDAError`).
   *
   * ---
   * ### Example
   *
   * ```ts
   * import { SignMessageVersion } from "@ledgerhq/device-signer-kit-solana";
   *
   * const { observable } = signerSolana.signMessage(
   *   "m/44'/501'/0'/0'",
   *   "Hello World",
   *   { version: SignMessageVersion.V0 },
   * );
   * observable.subscribe({
   *   next: state => {
   *     if (state.status === DeviceActionStatus.Pending) {
   *       console.log("Waiting for user action...", state.intermediateValue);
   *     }
   *     if (state.status === DeviceActionStatus.Completed) {
   *       console.log("Signature:", state.output.signature);
   *     }
   *   },
   *   error: err => console.error("Error:", err),
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
   * ## getAddress
   * #### Retrieve a Solana address from Ledger devices.
   * ---
   * ### Parameters
   *
   * **Required**
   * - **derivationPath** `string`
   *   The derivation path of the account to retrieve the address from.
   *
   * **Optional**
   * - **options** `AddressOptions`
   *   - **checkOnDevice** `boolean`
   *     If `true`, prompts the user to verify the address on the device.
   *
   *   - **skipOpenApp** `boolean`
   *     If `true`, skips opening the Solana app on the device.
   *
   * ---
   * ### Returns
   *
   * - `observable` That emits DeviceActionState updates
   * - `cancel` A function to cancel the action on the Ledger device.
   *
   * ---
   * ### Internal Flow
   *
   * Under the hood, this method subscribes to an
   * `Observable<DeviceActionState<string, GetAddressDAError, IntermediateValue>>`.
   *
   * #### DeviceActionState
   * Represents the lifecycle of a device action:
   *
   * ```ts
   * type DeviceActionState<Output, Error, IntermediateValue> =
   *   | { status: DeviceActionStatus.NotStarted }
   *   | { status: DeviceActionStatus.Pending; intermediateValue: IntermediateValue }
   *   | { status: DeviceActionStatus.Stopped }
   *   | { status: DeviceActionStatus.Completed; output: Output }
   *   | { status: DeviceActionStatus.Error; error: Error };
   *
   * enum DeviceActionStatus {
   *   NotStarted = "not-started",
   *   Pending    = "pending",
   *   Stopped    = "stopped",
   *   Completed  = "completed",
   *   Error      = "error"
   * }
   * ```
   *
   * - **NotStarted** → Action hasn’t begun.
   * - **Pending** → Waiting for user confirmation on the device.
   *   Includes an `intermediateValue` of type `IntermediateValue`.
   * - **Stopped** → Action was cancelled before completion.
   * - **Completed** → Provides the base58-encoded address string, decoded to `Uint8Array`.
   * - **Error** → The device or signing operation failed (`GetAddressDAError`).
   *
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
   * ## getAppConfiguration
   * #### Retrieve the current Solana app configuration from a Ledger device.
   * ---
   * ### Parameters
   *
   * This method does not require any parameters.
   *
   * ---
   * ### Returns
   *
   * - `observable` That emits DeviceActionState updates
   * - `cancel` A function to cancel the action on the Ledger device.
   *
   * ---
   * ### Internal Flow
   *
   * Under the hood, this method subscribes to an
   * `Observable<DeviceActionState<GetAppConfigurationResult, Error, IntermediateValue>>`.
   *
   * #### DeviceActionState
   * Represents the lifecycle of a device action:
   *
   * ```ts
   * type DeviceActionState<Output, Error, IntermediateValue> =
   *   | { status: DeviceActionStatus.NotStarted }
   *   | { status: DeviceActionStatus.Pending; intermediateValue: IntermediateValue }
   *   | { status: DeviceActionStatus.Stopped }
   *   | { status: DeviceActionStatus.Completed; output: Output }
   *   | { status: DeviceActionStatus.Error; error: Error };
   *
   * enum DeviceActionStatus {
   *   NotStarted = "not-started",
   *   Pending    = "pending",
   *   Stopped    = "stopped",
   *   Completed  = "completed",
   *   Error      = "error"
   * }
   * ```
   *
   * - **NotStarted** → Action hasn’t begun.
   * - **Pending** → Waiting for user confirmation on the device.
   *   Includes an `intermediateValue` of type `IntermediateValue`.
   * - **Stopped** → Action was cancelled before completion.
   * - **Completed** → Provides the app configuration object.
   * - **Error** → The device or signing operation failed.
   *
   * ---
   * ### Example
   *
   * ```ts
   * const config = await signerSolana.getAppConfiguration();
   * console.log(config.version, config.flags);
   * ```
   */
  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return this._container
      .get<GetAppConfigurationUseCase>(useCasesTypes.GetAppConfigurationUseCase)
      .execute();
  }
}
