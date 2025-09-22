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
import { type Transaction } from "@api/model/Transaction";
import { type SolanaTransactionOptions } from "@api/model/TransactionOptions";
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
   * - **options** `SolanaTransactionOptions`
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
   * `Promise<SolanaSignature>`
   * Resolves once the Ledger device signs the transaction.
   *
   * ```ts
   * type SolanaSignature = {
   *   signature: Uint8Array; // Signed transaction bytes
   * };
   * ```
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
   * **Basic usage**
   * ```ts
   * const sig = await signerSolana.signTransaction("m/44'/501'/0'/0'", serializedTx, {
   *   transactionResolutionContext: {
   *     tokenAddress: "So11111111111111111111111111111111111111112",
   *     createATA: {
   *       owner: "Fh9v...xyz",
   *       mint: "9n4n...eJ9E"
   *     }
   *   },
   * });
   * console.log(sig.signature);
   * ```
   *
   * **Advanced usage (observing device state)**
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
    solanaTransactionOptions?: SolanaTransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(useCasesTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, solanaTransactionOptions);
  }

  /**
   * ## signMessage
   * #### Securely sign an arbitrary message on Ledger devices.
   * ---
   * ### Parameters
   *
   * **Required**
   * - **derivationPath** `string`
   *   The derivation path used for signing.
   *
   * - **message** `string (hex-encoded)`
   *   The message to sign, provided as a hex string.
   *
   * **Optional**
   * - **options** `MessageOptions`
   *   - **skipOpenApp** `boolean`
   *     If `true`, skips opening the Solana app on the device.
   *
   * ---
   * ### Returns
   *
   * `Promise<SolanaSignature>`
   * Resolves once the Ledger device signs the message.
   *
   * ```ts
   * type SolanaSignature = {
   *   signature: Uint8Array; // Signed message bytes
   * };
   * ```
   *
   * ---
   * ### Internal Flow
   *
   * Under the hood, this method subscribes to an
   * `Observable<DeviceActionState<Uint8Array, SignMessageDAError, IntermediateValue>>`.
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
   * - **Completed** → Provides the signed message bytes (`Uint8Array`).
   * - **Error** → The device or signing operation failed (`SignMessageDAError`).
   *
   * ---
   * ### Example
   *
   * **Basic usage**
   * ```ts
   * const sig = await signerSolana.signMessage(
   *   "m/44'/501'/0'/0'",
   *   "48656c6c6f20576f726c64" // "Hello World" in hex
   * );
   * console.log(sig.signature);
   * ```
   *
   * **Advanced usage (observing device state)**
   * ```ts
   * const { observable } = signerSolana.signMessage(
   *   "m/44'/501'/0'/0'",
   *   "48656c6c6f20576f726c64" // hex string
   * );
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
  signMessage(
    derivationPath: string,
    message: string,
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
   * `Promise<SolanaAddress>`
   * Resolves with the derived Solana address.
   *
   * ```ts
   * type SolanaAddress = {
   *   address: Uint8Array; // 32-byte address
   * };
   * ```
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
   * ---
   * ### Example
   *
   * **Basic usage**
   * ```ts
   * const addr = await signerSolana.getAddress("m/44'/501'/0'/0'");
   * console.log(addr.address);
   * ```
   *
   * **With on-device verification**
   * ```ts
   * const addr = await signerSolana.getAddress("m/44'/501'/0'/0'", { checkOnDevice: true });
   * console.log(addr.address);
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
   * `Promise<GetAppConfigurationResult>`
   * Resolves with the app configuration details from the device.
   *
   * ```ts
   * type GetAppConfigurationResult = {
   *   version: string;
   *   flags: string[];
   * };
   * ```
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
