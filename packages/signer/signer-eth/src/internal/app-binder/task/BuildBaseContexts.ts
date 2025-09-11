import {
  type ClearSignContext,
  type ClearSignContextSuccess,
  type ClearSignContextSuccessType,
  ClearSignContextType,
  type ContextModule,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
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

export type BuildBaseContextsResult = {
  readonly clearSignContexts: ClearSignContextSuccess[];
  readonly clearSignContextsOptional: ClearSignContextSuccess[];
  readonly clearSigningType: ClearSigningType;
};

export type BuildBaseContextsArgs = {
  readonly contextModule: ContextModule;
  readonly options: TransactionOptions;
  readonly appConfig: GetConfigCommandResponse;
  readonly derivationPath: string;
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
    const { contextModule, options, appConfig, transaction, subset } =
      this._args;
    const deviceState = this._api.getDeviceSessionState();

    let filteredContexts: ClearSignContextSuccess[] = [];
    let filteredContextOptional: ClearSignContextSuccess[] = [];
    let clearSigningType: ClearSigningType = ClearSigningType.BASIC;

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
      await contextModule.getContexts({
        challenge: challenge,
        domain: options.domain,
        deviceModelId: deviceState.deviceModelId,
        rawTx:
          appConfig.transactionChecksEnabled && transaction
            ? bufferToHexaString(transaction)
            : undefined, // If transaction check is not enabled, don't pass the raw tx
        ...subset,
      });

    // NOTE: we need to filter out the ENUM and ERROR types
    // ENUM are handled differently
    // ERROR are not handled at all for now
    const clearSignContextsSuccess: ClearSignContextSuccess<
      Exclude<ClearSignContextSuccessType, ClearSignContextType.ENUM>
    >[] = clearSignContexts.filter(
      (context) =>
        context.type !== ClearSignContextType.ERROR &&
        context.type !== ClearSignContextType.ENUM,
    );

    const transactionCheck = clearSignContextsSuccess.find(
      (ctx) => ctx.type === ClearSignContextType.TRANSACTION_CHECK,
    );

    // Retrieve all ENUM contexts
    const transactionEnums: ClearSignContextSuccess<ClearSignContextType.ENUM>[] =
      clearSignContexts.filter(
        (context) => context.type === ClearSignContextType.ENUM,
      );

    const transactionInfo = clearSignContextsSuccess.find(
      (ctx) => ctx.type === ClearSignContextType.TRANSACTION_INFO,
    );

    // If the device does not support the generic parser,
    // we need to filter out the transaction info and transaction field description
    // as they are not supported by the device
    if (
      !this.supportsGenericParser(deviceState, appConfig) ||
      transactionInfo === undefined
    ) {
      filteredContexts = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type !== ClearSignContextType.TRANSACTION_INFO &&
          ctx.type !== ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
      );
    } else if (transactionInfo.certificate) {
      const transactionFields = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type === ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
      );
      const proxyContexts = clearSignContextsSuccess.filter(
        (ctx) => ctx.type === ClearSignContextType.PROXY_DELEGATE_CALL,
      );
      const dynamicNetworkContexts = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type === ClearSignContextType.DYNAMIC_NETWORK ||
          ctx.type === ClearSignContextType.DYNAMIC_NETWORK_ICON,
      );

      filteredContexts = [
        ...dynamicNetworkContexts,
        ...proxyContexts,
        transactionInfo,
        ...transactionFields,
        ...(transactionCheck ? [transactionCheck] : []),
      ];
      filteredContextOptional = [...transactionEnums];
      clearSigningType = ClearSigningType.EIP7730;
    }

    return {
      clearSignContexts: filteredContexts,
      clearSignContextsOptional: filteredContextOptional,
      clearSigningType,
    };
  }

  private supportsGenericParser(
    deviceState: DeviceSessionState,
    appConfig: GetConfigCommandResponse,
  ): boolean {
    return new ApplicationChecker(deviceState, appConfig)
      .withMinVersionExclusive("1.14.0")
      .excludeDeviceModel(DeviceModelId.NANO_S)
      .check();
  }
}
