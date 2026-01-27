import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  type DeviceSessionState,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { ClearSigningType } from "@api/model/ClearSigningType";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { ApplicationChecker } from "@internal/shared/utils/ApplicationChecker";

export const NESTED_CALLDATA_CONTEXT_TYPES_FILTER: ClearSignContextType[] = [
  ClearSignContextType.TRUSTED_NAME,
  ClearSignContextType.TRANSACTION_INFO,
  ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
  ClearSignContextType.ENUM,
  ClearSignContextType.PROXY_INFO,
];

export const BASE_CONTEXT_TYPES_FILTER: ClearSignContextType[] = [
  ClearSignContextType.TRANSACTION_INFO,
  ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
  ClearSignContextType.PROXY_INFO,
  ClearSignContextType.TRANSACTION_CHECK,
  ClearSignContextType.DYNAMIC_NETWORK,
  ClearSignContextType.DYNAMIC_NETWORK_ICON,
  ClearSignContextType.ENUM,
  ClearSignContextType.TRUSTED_NAME,
  ClearSignContextType.TOKEN,
  ClearSignContextType.NFT,
  ClearSignContextType.PLUGIN,
  ClearSignContextType.EXTERNAL_PLUGIN,
];

export type BuildBaseContextsResult = {
  readonly clearSignContexts: ClearSignContextSuccess[];
  readonly clearSignContextsOptional: ClearSignContextSuccess[];
  readonly clearSigningType: ClearSigningType;
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
    const contextsSuccess: ClearSignContextSuccess[] = clearSignContexts.filter(
      (context) => context.type !== ClearSignContextType.ERROR,
    );

    if (
      this._supportsGenericParser(deviceState, appConfig) &&
      this._hasValidTransactionInfo(contextsSuccess)
    ) {
      return this._getERC7730Contexts(contextsSuccess);
    } else {
      return this._getBasicContexts(contextsSuccess);
    }
  }

  private _getERC7730Contexts(
    contexts: ClearSignContextSuccess[],
  ): BuildBaseContextsResult {
    const clearSignContexts: ClearSignContextSuccess[] = contexts
      .filter((context) => this._isContextNeededForERC7730ClearSigning(context))
      .sort(
        (a, b) => this._getContextPriority(a) - this._getContextPriority(b),
      );

    const clearSignContextsOptional: ClearSignContextSuccess[] =
      contexts.filter((context) => context.type === ClearSignContextType.ENUM);

    return {
      clearSignContexts,
      clearSignContextsOptional,
      clearSigningType: ClearSigningType.EIP7730,
    };
  }

  private _getBasicContexts(
    contexts: ClearSignContextSuccess[],
  ): BuildBaseContextsResult {
    const clearSignContexts: ClearSignContextSuccess[] = contexts
      .filter((context) => this._isContextNeededForBasicClearSigning(context))
      .sort(
        (a, b) => this._getContextPriority(a) - this._getContextPriority(b),
      );

    return {
      clearSignContexts,
      clearSignContextsOptional: [],
      clearSigningType: ClearSigningType.BASIC,
    };
  }

  private _isContextNeededForBasicClearSigning({
    type,
  }: ClearSignContextSuccess): boolean {
    switch (type) {
      case ClearSignContextType.TRANSACTION_CHECK:
      case ClearSignContextType.PLUGIN:
      case ClearSignContextType.EXTERNAL_PLUGIN:
      case ClearSignContextType.DYNAMIC_NETWORK:
      case ClearSignContextType.DYNAMIC_NETWORK_ICON:
      case ClearSignContextType.TRUSTED_NAME:
      case ClearSignContextType.TOKEN:
      case ClearSignContextType.NFT:
        return true;
      case ClearSignContextType.TRANSACTION_INFO:
      case ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
      case ClearSignContextType.ENUM:
      case ClearSignContextType.PROXY_INFO:
      case ClearSignContextType.SAFE:
      case ClearSignContextType.SIGNER:
        return false;
      default: {
        const uncoveredType: never = type;
        throw new Error(`Unhandled context type ${String(uncoveredType)}`);
      }
    }
  }

  private _isContextNeededForERC7730ClearSigning({
    type,
  }: ClearSignContextSuccess): boolean {
    switch (type) {
      case ClearSignContextType.TRANSACTION_INFO:
      case ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
      case ClearSignContextType.PROXY_INFO:
      case ClearSignContextType.DYNAMIC_NETWORK:
      case ClearSignContextType.DYNAMIC_NETWORK_ICON:
      case ClearSignContextType.TRANSACTION_CHECK:
        return true;
      case ClearSignContextType.ENUM: // enum is needed but as optional
      case ClearSignContextType.TRUSTED_NAME:
      case ClearSignContextType.TOKEN:
      case ClearSignContextType.NFT:
      case ClearSignContextType.PLUGIN:
      case ClearSignContextType.EXTERNAL_PLUGIN:
      case ClearSignContextType.SAFE:
      case ClearSignContextType.SIGNER:
        return false;
      default: {
        const uncoveredType: never = type;
        throw new Error(`Unhandled context type ${String(uncoveredType)}`);
      }
    }
  }

  private _hasValidTransactionInfo(
    contexts: ClearSignContextSuccess[],
  ): boolean {
    return (
      contexts.find(
        (context) => context.type === ClearSignContextType.TRANSACTION_INFO,
      )?.certificate !== undefined
    );
  }

  private _supportsGenericParser(
    deviceState: DeviceSessionState,
    appConfig: GetConfigCommandResponse,
  ): boolean {
    return new ApplicationChecker(deviceState, appConfig)
      .withMinVersionExclusive("1.14.0")
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
  private _getContextPriority({ type }: ClearSignContextSuccess): number {
    switch (type) {
      case ClearSignContextType.TRANSACTION_CHECK:
        return 10;
      case ClearSignContextType.DYNAMIC_NETWORK:
      case ClearSignContextType.DYNAMIC_NETWORK_ICON:
      case ClearSignContextType.PROXY_INFO:
        return 30;
      case ClearSignContextType.TRANSACTION_INFO:
        return 50;
      case ClearSignContextType.PLUGIN:
      case ClearSignContextType.EXTERNAL_PLUGIN:
      case ClearSignContextType.TOKEN:
      case ClearSignContextType.NFT:
      case ClearSignContextType.TRUSTED_NAME:
      case ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION:
      case ClearSignContextType.ENUM:
        return 70;

      /* not used here */
      case ClearSignContextType.SAFE:
      case ClearSignContextType.SIGNER:
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
