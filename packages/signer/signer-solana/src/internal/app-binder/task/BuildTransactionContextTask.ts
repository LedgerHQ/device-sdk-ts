import {
  type ContextModule,
  type PkiCertificate,
} from "@ledgerhq/context-module";
import {
  DeviceModelId,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type TransactionOptions } from "@api/model/TransactionOptions";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

export type SolanaBuildContextResult = {
  challenge: string | undefined;
  addressResult: {
    tokenAccount: string;
    owner: string;
    contract: string;
  };
  calCertificate: PkiCertificate;
  descriptor: Uint8Array;
};

export type BuildTransactionContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly options: TransactionOptions;
};

export class BuildTransactionContextTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildTransactionContextTaskArgs,
  ) {}

  async run(): Promise<SolanaBuildContextResult> {
    const { contextModule, options } = this.args;
    const deviceState = this.api.getDeviceSessionState();

    let challenge: string | undefined = undefined;
    if (deviceState.deviceModelId !== DeviceModelId.NANO_S) {
      const challengeRes = await this.api.sendCommand(
        new GetChallengeCommand(),
      );

      if (isSuccessCommandResult(challengeRes)) {
        challenge = challengeRes.data.challenge;
      } else {
        throw new Error(
          "[signer-solana] - BuildTransactionContextTask: Failed to get challenge from device.",
        );
      }
    }

    const contextResult = await contextModule.getSolanaContext({
      deviceModelId: deviceState.deviceModelId,
      tokenAddress: options.tokenAddress,
      challenge,
      createATA: options.createATA,
    });

    if (contextResult === null) {
      throw new Error(
        "[signer-solana] - BuildTransactionContextTask: Solana context not available",
      );
    }

    const { certificate, tokenAccount, owner, contract, descriptor } =
      contextResult;

    return {
      challenge,
      descriptor,
      addressResult: { tokenAccount, owner, contract },
      calCertificate: certificate,
    };
  }
}
