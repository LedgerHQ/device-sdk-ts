import {
  type ClearSignContextSuccess,
  type ClearSignContextSuccessType,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  type DeviceSessionState,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TransactionType } from "@api/model/TransactionType";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import {
  GetWeb3CheckTask,
  type GetWeb3CheckTaskArgs,
} from "@internal/app-binder/task/GetWeb3CheckTask";
import { ApplicationChecker } from "@internal/shared/utils/ApplicationChecker";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

import { type GenericContext } from "./ProvideTransactionGenericContextTask";

export type BuildTransactionTaskResult = {
  readonly clearSignContexts: ClearSignContextSuccess[] | GenericContext;
  readonly serializedTransaction: Uint8Array;
  readonly chainId: number;
  readonly transactionType: TransactionType;
};

export type BuildTransactionContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly mapper: TransactionMapperService;
  readonly transaction: Uint8Array;
  readonly options: TransactionOptions;
  readonly appConfig: GetConfigCommandResponse;
  readonly derivationPath: string;
};

export class BuildTransactionContextTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: BuildTransactionContextTaskArgs,
    private readonly getWeb3ChecksFactory = (
      api: InternalApi,
      args: GetWeb3CheckTaskArgs,
    ) => new GetWeb3CheckTask(api, args),
  ) {}

  async run(): Promise<BuildTransactionTaskResult> {
    const {
      contextModule,
      mapper,
      transaction,
      options,
      appConfig,
      derivationPath,
    } = this._args;
    const deviceState = this._api.getDeviceSessionState();

    // Parse transaction
    const parsed = mapper.mapTransactionToSubset(transaction);
    parsed.ifLeft((err) => {
      throw err;
    });
    const { subset, serializedTransaction, type } = parsed.unsafeCoerce();

    // Run the web3checks if needed
    let web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null =
      null;
    if (appConfig.web3ChecksEnabled) {
      web3Check = (
        await this.getWeb3ChecksFactory(this._api, {
          contextModule,
          derivationPath,
          mapper,
          transaction,
        }).run()
      ).web3Check;
    }

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
    const clearSignContexts = await contextModule.getContexts({
      challenge: challenge,
      domain: options.domain,
      deviceModelId: deviceState.deviceModelId,
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

    // Retrieve all ENUM contexts
    const transactionEnums: ClearSignContextSuccess<ClearSignContextType.ENUM>[] =
      clearSignContexts.filter(
        (context) => context.type === ClearSignContextType.ENUM,
      );

    let filteredContexts: ClearSignContextSuccess[] | GenericContext = [];
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

      // If the device supports the web3 check, we need to add it to the list of contexts
      if (web3Check) {
        filteredContexts = [web3Check, ...filteredContexts];
      }
    } else if (transactionInfo.certificate) {
      const transactionFields = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type === ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
      );

      filteredContexts = {
        transactionInfo: transactionInfo.payload,
        transactionInfoCertificate: transactionInfo.certificate!,
        transactionFields,
        transactionEnums,
        web3Check,
      };
    }

    return {
      clearSignContexts: filteredContexts,
      serializedTransaction,
      chainId: subset.chainId,
      transactionType: type,
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
