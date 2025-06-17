import {
  type ContextModule,
  type PkiCertificate,
} from "@ledgerhq/context-module";
import {
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

    // get challenge
    let challenge: string | undefined;
    const challengeRes = await this.api.sendCommand(new GetChallengeCommand());
    if (isSuccessCommandResult(challengeRes)) {
      challenge = challengeRes.data.challenge;
    }

    // get Solana context
    const contextResult = await contextModule.getSolanaContext({
      deviceModelId: deviceState.deviceModelId,
      tokenAddress: options.tokenAddress,
      challenge,
      createATA: options.createATA,
    });

    return contextResult.caseOf({
      Left: (err) => {
        throw err;
      },
      Right: (ctx) => {
        return {
          challenge,
          descriptor: ctx.descriptor,
          addressResult: {
            tokenAccount: ctx.tokenAccount,
            owner: ctx.owner,
            contract: ctx.contract,
          },
          calCertificate: ctx.certificate,
        };
      },
    });
  }
}
