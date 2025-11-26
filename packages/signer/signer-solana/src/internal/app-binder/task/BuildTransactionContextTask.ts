import {
  type ContextModule,
  type PkiCertificate,
  type SolanaContextLoaderResults,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type TransactionResolutionContext } from "@api/model/TransactionResolutionContext";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

export type SolanaBuildContextResult = {
  trustedNamePKICertificate: PkiCertificate;
  tlvDescriptor: Uint8Array;
  loadersResults: SolanaContextLoaderResults;
};

export type BuildTransactionContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly options: TransactionResolutionContext;
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
      tokenInternalId: options.tokenInternalId,
      templateId: options.templateId,
    });

    return contextResult.caseOf({
      Left: (err) => {
        throw err;
      },
      Right: (ctx) => {
        return {
          tlvDescriptor: ctx.tlvDescriptor,
          trustedNamePKICertificate: ctx.trustedNamePKICertificate,
          loadersResults: ctx.loadersResults,
        };
      },
    });
  }
}
