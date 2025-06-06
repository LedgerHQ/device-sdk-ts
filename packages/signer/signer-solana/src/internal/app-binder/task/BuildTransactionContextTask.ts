import {
  type ContextModule,
  type PkiCertificate,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

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

  async run(): Promise<Either<Error, SolanaBuildContextResult>> {
    const { contextModule, options } = this.args;
    const deviceState = this.api.getDeviceSessionState();

    // get challenge
    let challenge: string | undefined;
    const challengeRes = await this.api.sendCommand(new GetChallengeCommand());
    if (isSuccessCommandResult(challengeRes)) {
      challenge = challengeRes.data.challenge;
    }

    // fetch the Solana context
    const eitherContext = await contextModule.getSolanaContext({
      deviceModelId: deviceState.deviceModelId,
      tokenAddress: options.tokenAddress,
      challenge,
      createATA: options.createATA,
    });

    return eitherContext.map((ctx) => ({
      challenge,
      descriptor: ctx.descriptor,
      addressResult: {
        tokenAccount: ctx.tokenAccount,
        owner: ctx.owner,
        contract: ctx.contract,
      },
      calCertificate: ctx.certificate,
    }));
  }
}
