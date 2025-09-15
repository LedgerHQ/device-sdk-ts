import {
  type ClearSignContextSuccess,
  type ClearSignContextType,
  type ContextModule,
  type TypedDataCalldataIndex,
  type TypedDataClearSignContextSuccess,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  type DeviceSessionState,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { ClearSigningType } from "@api/model/ClearSigningType";
import { type TypedData } from "@api/model/TypedData";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import {
  BuildFullContextsTask,
  type BuildFullContextsTaskArgs,
  type ContextWithSubContexts,
} from "@internal/app-binder/task/BuildFullContextsTask";
import {
  GetWeb3CheckTask,
  type GetWeb3CheckTaskArgs,
} from "@internal/app-binder/task/GetWeb3CheckTask";
import { type ProvideEIP712ContextTaskArgs } from "@internal/app-binder/task/ProvideEIP712ContextTask";
import { ApplicationChecker } from "@internal/shared/utils/ApplicationChecker";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import { TypedDataValueField } from "@internal/typed-data/model/Types";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export class BuildEIP712ContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly contextModule: ContextModule,
    private readonly parser: TypedDataParserService,
    private readonly transactionParser: TransactionParserService,
    private readonly transactionMapper: TransactionMapperService,
    private readonly data: TypedData,
    private readonly derivationPath: string,
    private readonly appConfig: GetConfigCommandResponse,
    private readonly getWeb3ChecksFactory = (
      api: InternalApi,
      args: GetWeb3CheckTaskArgs,
    ) => new GetWeb3CheckTask(api, args),
    private readonly buildFullContextFactory = (
      api: InternalApi,
      args: BuildFullContextsTaskArgs,
    ) => new BuildFullContextsTask(api, args),
  ) {}

  async run(): Promise<ProvideEIP712ContextTaskArgs> {
    // Run the web3checks if needed
    let web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null =
      null;
    if (this.appConfig.web3ChecksEnabled) {
      web3Check = (
        await this.getWeb3ChecksFactory(this.api, {
          contextModule: this.contextModule,
          derivationPath: this.derivationPath,
          data: this.data,
        }).run()
      ).web3Check;
    }

    // Clear signing context
    // Parse the message types and values
    const parsed = this.parser.parse(this.data);
    if (parsed.isLeft()) {
      throw parsed.extract();
    }
    const { types, domain, message } = parsed.unsafeCoerce();

    // Get clear signing context, if any
    const deviceState = this.api.getDeviceSessionState();
    let clearSignContext: Maybe<TypedDataClearSignContextSuccess> = Nothing;
    let calldatasContexts: Record<
      TypedDataCalldataIndex,
      ContextWithSubContexts[]
    > = {};
    const version = this.getClearSignVersion(deviceState);
    if (version.isJust()) {
      // Get challenge
      let challenge: string | undefined = undefined;
      const challengeRes = await this.api.sendCommand(
        new GetChallengeCommand(),
      );
      if (isSuccessCommandResult(challengeRes)) {
        challenge = challengeRes.data.challenge;
      }

      // Get filters
      const verifyingContract =
        this.data.domain.verifyingContract?.toLowerCase() || ZERO_ADDRESS;
      const chainId = this.data.domain.chainId || 0;
      const fieldsValues = message
        .filter((v) => v.value instanceof TypedDataValueField)
        .map((v) => ({
          path: v.path,
          value: (v.value as TypedDataValueField).data,
        }));
      const filters = await this.contextModule.getTypedDataFilters({
        verifyingContract,
        chainId,
        version: version.extract(),
        schema: this.data.types,
        challenge,
        deviceModelId: deviceState.deviceModelId,
        fieldsValues,
      });
      if (filters.type === "success") {
        clearSignContext = Just(filters);
        calldatasContexts = await this.getCalldatasContexts(
          deviceState,
          filters,
        );
      }
    }

    // Return the args for provide context task
    const provideTaskArgs: ProvideEIP712ContextTaskArgs = {
      derivationPath: this.derivationPath,
      web3Check,
      types,
      domain,
      message,
      clearSignContext,
      calldatasContexts,
    };
    return provideTaskArgs;
  }

  private getClearSignVersion(
    deviceState: DeviceSessionState,
  ): Maybe<"v1" | "v2"> {
    if (
      !new ApplicationChecker(deviceState, this.appConfig)
        .withMinVersionInclusive("1.10.0")
        .excludeDeviceModel(DeviceModelId.NANO_S)
        .check()
    ) {
      return Nothing;
    }

    // EIP712 v2 (amount & datetime filters) supported since 1.11.0:
    // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#1110-1
    // But some issues were still present until 1.12.0 among which:
    // * V2 descriptor with missing token not supported by the app
    // * Empty arrays with filters not correctly handled
    // * Trusted name filters not yet released
    // Therefore it's safer and easier to use V1 filters before 1.12.0:
    // https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#1120
    const shouldUseV2Filters = new ApplicationChecker(
      deviceState,
      this.appConfig,
    )
      .withMinVersionInclusive("1.12.0")
      .check();
    return shouldUseV2Filters ? Just("v2") : Just("v1");
  }

  private async getCalldatasContexts(
    deviceState: DeviceSessionState,
    filters: TypedDataClearSignContextSuccess,
  ): Promise<Record<TypedDataCalldataIndex, ContextWithSubContexts[]>> {
    const calldatasContexts: Record<
      TypedDataCalldataIndex,
      ContextWithSubContexts[]
    > = {};
    for (const calldataIndex in filters.calldatas) {
      const { subset } = filters.calldatas[calldataIndex]!;
      const calldataContext = await this.buildFullContextFactory(this.api, {
        contextModule: this.contextModule,
        mapper: this.transactionMapper,
        parser: this.transactionParser,
        options: {},
        appConfig: this.appConfig,
        derivationPath: this.derivationPath,
        subset,
        deviceModelId: deviceState.deviceModelId,
      }).run();
      if (calldataContext.clearSigningType === ClearSigningType.EIP7730) {
        calldatasContexts[calldataIndex] = calldataContext.clearSignContexts;
      }
    }
    return calldatasContexts;
  }
}
