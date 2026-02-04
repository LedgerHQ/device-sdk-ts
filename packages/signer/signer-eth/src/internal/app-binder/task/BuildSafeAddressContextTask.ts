import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type SafeAddressOptions } from "@api/model/SafeAddressOptions";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

export type BuildSafeAddressContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly safeContractAddress: string;
  readonly options: SafeAddressOptions;
  readonly deviceModelId: DeviceModelId;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

export type BuildSafeAddressContextTaskResult = {
  readonly clearSignContexts: ClearSignContextSuccess[];
};

export class BuildSafeAddressContextTask {
  private readonly _logger: LoggerPublisherService;

  constructor(
    private readonly _api: InternalApi,
    private readonly _args: BuildSafeAddressContextTaskArgs,
  ) {
    this._logger = _args.loggerFactory("BuildSafeAddressContextTask");
  }

  async run(): Promise<BuildSafeAddressContextTaskResult> {
    this._logger.debug("[run] Starting BuildSafeAddressContextTask", {
      data: {
        safeContractAddress: this._args.safeContractAddress,
        chainId: this._args.options.chainId,
      },
    });

    const challengeResponse = await this._api.sendCommand(
      new GetChallengeCommand(),
    );

    if (!isSuccessCommandResult(challengeResponse)) {
      this._logger.error("[run] Failed to get challenge");
      throw new Error("Failed to get challenge");
    }

    const challenge = challengeResponse.data.challenge;

    const contexts = await this._args.contextModule.getContexts(
      {
        safeContractAddress: this._args.safeContractAddress,
        chainId: this._args.options.chainId,
        deviceModelId: this._args.deviceModelId,
        challenge,
      },
      [ClearSignContextType.SAFE, ClearSignContextType.SIGNER],
    );

    contexts.forEach((context) => {
      if (context.type === ClearSignContextType.ERROR) {
        throw new Error(context.error.message);
      }
    });

    // should contain one SAFE and one SIGNER context
    if (
      contexts.length !== 2 ||
      contexts.find((context) => context.type === ClearSignContextType.SAFE) ===
        undefined ||
      contexts.find(
        (context) => context.type === ClearSignContextType.SIGNER,
      ) === undefined
    ) {
      this._logger.error("[run] Invalid safe address contexts", {
        data: {
          receivedTypes: contexts.map((c) => c.type),
          expectedTypes: [
            ClearSignContextType.SAFE,
            ClearSignContextType.SIGNER,
          ],
        },
      });
      throw new Error("Invalid safe address contexts");
    }

    this._logger.debug(
      "[run] BuildSafeAddressContextTask completed successfully",
    );

    return {
      clearSignContexts: contexts as ClearSignContextSuccess[],
    };
  }
}
