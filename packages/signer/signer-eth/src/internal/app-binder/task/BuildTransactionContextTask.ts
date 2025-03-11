import {
  type ClearSignContextSuccess,
  type ClearSignContextSuccessType,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  type DeviceSessionState,
  DeviceSessionStateType,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { gte } from "semver";

import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TransactionType } from "@api/model/TransactionType";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { ETHEREUM_PLUGINS } from "@internal/app-binder/constant/plugins";
import {
  GetWeb3CheckTask,
  type GetWeb3CheckTaskArgs,
} from "@internal/app-binder/task/GetWeb3CheckTask";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

import { type GenericContext } from "./ProvideTransactionGenericContextTask";

export type BuildTransactionTaskResult = {
  readonly clearSignContexts: ClearSignContextSuccess[] | GenericContext;
  readonly serializedTransaction: Uint8Array;
  readonly chainId: number;
  readonly transactionType: TransactionType;
  readonly web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null;
};

export type BuildTransactionContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly mapper: TransactionMapperService;
  readonly transaction: Uint8Array;
  readonly options: TransactionOptions;
  readonly derivationPath: string;
};

export class BuildTransactionContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildTransactionContextTaskArgs,
    private getWeb3ChecksFactory = (
      api: InternalApi,
      args: GetWeb3CheckTaskArgs,
    ) => new GetWeb3CheckTask(api, args),
  ) {}

  async run(): Promise<BuildTransactionTaskResult> {
    const { contextModule, mapper, transaction, options, derivationPath } =
      this.args;
    const deviceState = this.api.getDeviceSessionState();

    // Parse transaction
    const parsed = mapper.mapTransactionToSubset(transaction);
    parsed.ifLeft((err) => {
      throw err;
    });
    const { subset, serializedTransaction, type } = parsed.unsafeCoerce();

    // Run the web3checks if needed
    const web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null =
      (
        await this.getWeb3ChecksFactory(this.api, {
          contextModule,
          derivationPath,
          mapper,
          transaction,
        }).run()
      ).web3Check;

    // Get challenge
    let challenge: string | undefined = undefined;
    const challengeRes = await this.api.sendCommand(new GetChallengeCommand());
    if (isSuccessCommandResult(challengeRes)) {
      challenge = challengeRes.data.challenge;
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

    if (transactionInfo && !transactionInfo.certificate) {
      throw new Error("Transaction info certificate is missing");
    }

    // If the device does not support the generic parser,
    // we need to filter out the transaction info and transaction field description
    // as they are not supported by the device
    if (
      !this.supportsGenericParser(deviceState) ||
      transactionInfo === undefined
    ) {
      filteredContexts = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type !== ClearSignContextType.TRANSACTION_INFO &&
          ctx.type !== ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
      );
    } else {
      const transactionFields = clearSignContextsSuccess.filter(
        (ctx) =>
          ctx.type === ClearSignContextType.TRANSACTION_FIELD_DESCRIPTION,
      );
      filteredContexts = {
        transactionInfo: transactionInfo.payload,
        transactionInfoCertificate: transactionInfo.certificate!,
        transactionFields,
        transactionEnums,
      };
    }

    return {
      clearSignContexts: filteredContexts,
      serializedTransaction,
      chainId: subset.chainId,
      transactionType: type,
      web3Check,
    };
  }

  private supportsGenericParser(deviceState: DeviceSessionState): boolean {
    if (deviceState.sessionStateType === DeviceSessionStateType.Connected) {
      return false;
    }

    if (
      deviceState.currentApp.name !== "Ethereum" &&
      !ETHEREUM_PLUGINS.includes(deviceState.currentApp.name)
    ) {
      // Sanity check, should never happen as open app is called before this task
      throw new Error("Unsupported app");
    }

    if (deviceState.deviceModelId === DeviceModelId.NANO_S) {
      return false;
    }
    return gte(deviceState.currentApp.version, "1.15.0");
  }
}
