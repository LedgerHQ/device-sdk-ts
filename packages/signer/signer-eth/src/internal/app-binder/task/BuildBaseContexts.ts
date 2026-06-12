import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type EthereumClearSignContextSuccess,
  isEthereumClearSignContextSuccess,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  ApplicationChecker,
  DeviceModelId,
  type DeviceSessionState,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { ClearSigningType } from "@api/model/ClearSigningType";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { EthereumApplicationResolver } from "@internal/app-binder/EthereumApplicationResolver";
import {
  MIN_ETH_APP_VERSION_FOR_GATED_SIGNING,
  MIN_ETH_APP_VERSION_FOR_GENERIC_PARSER,
} from "@internal/shared/EthAppVersions";

export const NESTED_CALLDATA_CONTEXT_TYPES_FILTER: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_TRUSTED_NAME,
  ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
  ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
  ClearSignContextType.ETHEREUM_ENUM,
  ClearSignContextType.ETHEREUM_PROXY_INFO,
];

export const BASE_CONTEXT_TYPES_FILTER: ClearSignContextType[] = [
  ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
  ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION,
  ClearSignContextType.ETHEREUM_PROXY_INFO,
  ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
  ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK,
  ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON,
  ClearSignContextType.ETHEREUM_ENUM,
  ClearSignContextType.ETHEREUM_TRUSTED_NAME,
  ClearSignContextType.ETHEREUM_TOKEN,
  ClearSignContextType.ETHEREUM_NFT,
  ClearSignContextType.ETHEREUM_PLUGIN,
  ClearSignContextType.ETHEREUM_EXTERNAL_PLUGIN,
  ClearSignContextType.ETHEREUM_GATED_SIGNING,
  ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL,
  ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT,
];

export type BuildBaseContextsResult = {
  readonly clearSignContexts: EthereumClearSignContextSuccess[];
  readonly clearSignContextsOptional: EthereumClearSignContextSuccess[];
  readonly clearSigningType: ClearSigningType;
  readonly contextErrorCount: number;
};

export type BuildBaseContextsArgs = {
  readonly contextModule: ContextModule;
  readonly options: TransactionOptions;
  readonly appConfig: GetConfigCommandResponse;
  readonly subset: TransactionSubset;
  readonly transaction?: Uint8Array;
};

/**
 * Builds the base contexts for a transaction
 * @param api - The internal API
 * @param args - The arguments for the build
 *
 * returns the base contexts for a transaction, without subcontexts or nested call data contexts
 */
export class BuildBaseContexts {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: BuildBaseContextsArgs,
  ) {}

  async run(): Promise<BuildBaseContextsResult> {
    const { contextModule, appConfig, transaction, subset } = this._args;
    const isNestedCallData = transaction === undefined;
    // As only transaction checks needs the transaction, we don't need to send it if it's not needed
    const needTransaction = !isNestedCallData && appConfig.web3ChecksEnabled;

    const deviceState = this._api.getDeviceSessionState();

    // Get challenge (not supported on Nano S)
    let challenge: string | undefined = undefined;
    if (deviceState.deviceModelId !== DeviceModelId.NANO_S) {
      const challengeRes = await this._api.sendCommand(
        new GetChallengeCommand(),
      );
      if (isSuccessCommandResult(challengeRes)) {
        challenge = challengeRes.data.challenge;
      }
    }

    // Get the clear sign contexts
    const clearSignContexts: ClearSignContext[] =
      await contextModule.getContexts(
        {
          challenge: challenge,
          deviceModelId: deviceState.deviceModelId,
          transaction: needTransaction ? transaction : undefined,
          ...subset,
        },
        isNestedCallData
          ? NESTED_CALLDATA_CONTEXT_TYPES_FILTER
          : BASE_CONTEXT_TYPES_FILTER,
      );

    // filter out the error contexts
    const contextErrorCount = clearSignContexts.filter(
      (context) => context.type === ClearSignContextType.ERROR,
    ).length;
    const contextsSuccess: ClearSignContextSuccess[] = clearSignContexts.filter(
      (context) => context.type !== ClearSignContextType.ERROR,
    );

    const ethContexts: EthereumClearSignContextSuccess[] =
      contextsSuccess.filter(isEthereumClearSignContextSuccess);

    // Remove gating contexts when app does not support them
    const supportsGatedSigning = new ApplicationChecker(
      deviceState,
      appConfig,
      new EthereumApplicationResolver(),
    )
      .withMinVersionInclusive(MIN_ETH_APP_VERSION_FOR_GATED_SIGNING)
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
    const contextsForSigning = supportsGatedSigning
      ? ethContexts
      : ethContexts.filter(
          (context) =>
            context.type !== ClearSignContextType.ETHEREUM_GATED_SIGNING,
        );

    if (
      this._supportsGenericParser(deviceState, appConfig) &&
      this._hasValidTransactionInfo(contextsForSigning)
    ) {
      return this._getERC7730Contexts(contextsForSigning, contextErrorCount);
    } else {
      return this._getBasicContexts(contextsForSigning, contextErrorCount);
    }
  }

  private _getERC7730Contexts(
    contexts: EthereumClearSignContextSuccess[],
    contextErrorCount: number,
  ): BuildBaseContextsResult {
    const clearSignContexts: EthereumClearSignContextSuccess[] = contexts
      .filter((context) => this._isContextNeededForERC7730ClearSigning(context))
      .sort(
        (a, b) => this._getContextPriority(a) - this._getContextPriority(b),
      );

    const clearSignContextsOptional: EthereumClearSignContextSuccess[] =
      contexts.filter(
        (context) => context.type === ClearSignContextType.ETHEREUM_ENUM,
      );

    return {
      clearSignContexts,
      clearSignContextsOptional,
      clearSigningType: ClearSigningType.EIP7730,
      contextErrorCount,
    };
  }

  private _getBasicContexts(
    contexts: EthereumClearSignContextSuccess[],
    contextErrorCount: number,
  ): BuildBaseContextsResult {
    const clearSignContexts: EthereumClearSignContextSuccess[] = contexts
      .filter((context) => this._isContextNeededForBasicClearSigning(context))
      .sort(
        (a, b) => this._getContextPriority(a) - this._getContextPriority(b),
      );

    return {
      clearSignContexts,
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
      contextErrorCount,
    };
  }

  private _isContextNeededForBasicClearSigning({
    type,
  }: EthereumClearSignContextSuccess): boolean {
    switch (type) {
      case ClearSignContextType.ETHEREUM_TRANSACTION_CHECK:
      case ClearSignContextType.ETHEREUM_PLUGIN:
      case ClearSignContextType.ETHEREUM_EXTERNAL_PLUGIN:
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK:
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON:
      case ClearSignContextType.ETHEREUM_TRUSTED_NAME:
      case ClearSignContextType.ETHEREUM_TOKEN:
      case ClearSignContextType.ETHEREUM_NFT:
      case ClearSignContextType.ETHEREUM_GATED_SIGNING:
      case ClearSignContextType.ETHEREUM_PROXY_INFO:
      case ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL:
      case ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT:
        return true;
      case ClearSignContextType.ETHEREUM_TRANSACTION_INFO:
      case ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION:
      case ClearSignContextType.ETHEREUM_ENUM:
      case ClearSignContextType.ETHEREUM_SAFE:
      case ClearSignContextType.ETHEREUM_SIGNER:
        return false;
      default: {
        const uncoveredType: never = type;
        throw new Error(`Unhandled context type ${String(uncoveredType)}`);
      }
    }
  }

  private _isContextNeededForERC7730ClearSigning({
    type,
  }: EthereumClearSignContextSuccess): boolean {
    switch (type) {
      case ClearSignContextType.ETHEREUM_TRANSACTION_INFO:
      case ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION:
      case ClearSignContextType.ETHEREUM_PROXY_INFO:
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK:
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON:
      case ClearSignContextType.ETHEREUM_TRANSACTION_CHECK:
      case ClearSignContextType.ETHEREUM_GATED_SIGNING:
      case ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL:
      case ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT:
        return true;
      case ClearSignContextType.ETHEREUM_ENUM:
      case ClearSignContextType.ETHEREUM_TRUSTED_NAME:
      case ClearSignContextType.ETHEREUM_TOKEN:
      case ClearSignContextType.ETHEREUM_NFT:
      case ClearSignContextType.ETHEREUM_PLUGIN:
      case ClearSignContextType.ETHEREUM_EXTERNAL_PLUGIN:
      case ClearSignContextType.ETHEREUM_SAFE:
      case ClearSignContextType.ETHEREUM_SIGNER:
        return false;
      default: {
        const uncoveredType: never = type;
        throw new Error(`Unhandled context type ${String(uncoveredType)}`);
      }
    }
  }

  private _hasValidTransactionInfo(
    contexts: EthereumClearSignContextSuccess[],
  ): boolean {
    return (
      contexts.find(
        (context) =>
          context.type === ClearSignContextType.ETHEREUM_TRANSACTION_INFO,
      )?.certificate !== undefined
    );
  }

  private _supportsGenericParser(
    deviceState: DeviceSessionState,
    appConfig: GetConfigCommandResponse,
  ): boolean {
    return new ApplicationChecker(
      deviceState,
      appConfig,
      new EthereumApplicationResolver(),
    )
      .withMinVersionExclusive(MIN_ETH_APP_VERSION_FOR_GENERIC_PARSER)
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
  }

  /**
   * Determines the processing priority of a clear sign context.
   * Lower numbers indicate higher priority (processed first).
   *
   * @param context The clear sign context to get priority for
   * @returns Priority number (lower = higher priority)
   */
  private _getContextPriority({
    type,
  }: EthereumClearSignContextSuccess): number {
    switch (type) {
      case ClearSignContextType.ETHEREUM_PROXY_INFO:
        return 5;
      case ClearSignContextType.ETHEREUM_TRANSACTION_CHECK:
      case ClearSignContextType.ETHEREUM_GATED_SIGNING:
        return 10;
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK:
      case ClearSignContextType.ETHEREUM_DYNAMIC_NETWORK_ICON:
        return 30;
      case ClearSignContextType.ETHEREUM_TRANSACTION_INFO:
        return 50;
      // Contacts run before TRUSTED_NAME so the friendly name is
      // already in place when the device renders the recipient field.
      // BuildFullContextsTask also drops ETHEREUM_TRUSTED_NAME entries
      // whose address is covered by a contact entry (Contacts wins).
      case ClearSignContextType.ETHEREUM_CONTACT_LEDGER_ACCOUNT:
      case ClearSignContextType.ETHEREUM_CONTACT_EXTERNAL:
        return 60;
      case ClearSignContextType.ETHEREUM_PLUGIN:
      case ClearSignContextType.ETHEREUM_EXTERNAL_PLUGIN:
      case ClearSignContextType.ETHEREUM_TOKEN:
      case ClearSignContextType.ETHEREUM_NFT:
      case ClearSignContextType.ETHEREUM_TRUSTED_NAME:
      case ClearSignContextType.ETHEREUM_TRANSACTION_FIELD_DESCRIPTION:
      case ClearSignContextType.ETHEREUM_ENUM:
        return 70;

      /* not used here */
      case ClearSignContextType.ETHEREUM_SAFE:
      case ClearSignContextType.ETHEREUM_SIGNER:
        return 90;

      default: {
        const uncoveredType: never = type;
        throw new Error(
          `Unhandled context type for priority: ${String(uncoveredType)}`,
        );
      }
    }
  }
}
