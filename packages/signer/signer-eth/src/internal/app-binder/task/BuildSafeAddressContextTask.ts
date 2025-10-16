import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type SafeAddressOptions } from "@api/model/SafeAddressOptions";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

export type BuildSafeAddressContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly safeContractAddress: string;
  readonly options: SafeAddressOptions;
  readonly deviceModelId: DeviceModelId;
};

export type BuildSafeAddressContextTaskResult = {
  readonly clearSignContexts: ClearSignContextSuccess[];
};

export class BuildSafeAddressContextTask {
  constructor(
    private readonly _api: InternalApi,
    private readonly _args: BuildSafeAddressContextTaskArgs,
  ) {}

  async run(): Promise<BuildSafeAddressContextTaskResult> {
    const challengeResponse = await this._api.sendCommand(
      new GetChallengeCommand(),
    );

    if (!isSuccessCommandResult(challengeResponse)) {
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
      throw new Error("Invalid safe address contexts");
    }

    return {
      clearSignContexts: contexts as ClearSignContextSuccess[],
    };
  }
}
