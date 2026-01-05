import {
  type ContextModule,
  type PkiCertificate,
  type SolanaContextLoaderResults,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
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
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

export class BuildTransactionContextTask {
  private readonly _logger: LoggerPublisherService;
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildTransactionContextTaskArgs,
  ) {
    this._logger = args.loggerFactory("BuildTransactionContextTask");
  }

  async run(): Promise<SolanaBuildContextResult> {
    this._logger.debug("[run] Starting BuildTransactionContextTask");
    const { contextModule, options } = this.args;
    const deviceState = this.api.getDeviceSessionState();

    // get challenge
    let challenge: string | undefined;
    const challengeRes = await this.api.sendCommand(new GetChallengeCommand());
    if (isSuccessCommandResult(challengeRes)) {
      challenge = challengeRes.data.challenge;
    } else {
      throw new Error("Failed to get challenge from device");
    }

    const contextModuleGetSolanaContextArgs = {
      deviceModelId: deviceState.deviceModelId,
      tokenAddress: options.tokenAddress,
      challenge,
      createATA: options.createATA,
      tokenInternalId: options.tokenInternalId,
      templateId: options.templateId,
    };
    // get Solana context
    this._logger.debug("[run] Calling contextModule.getSolanaContext", {
      data: {
        args: contextModuleGetSolanaContextArgs,
      },
    });
    const contextResult = await contextModule.getSolanaContext(
      contextModuleGetSolanaContextArgs,
    );

    return contextResult.caseOf({
      Left: (err) => {
        this._logger.error("[run] Solana context result", {
          data: {
            error: {
              message: err.message,
              name: err.name,
              stack: err.stack,
            },
          },
        });
        throw err;
      },
      Right: (ctx) => {
        this._logger.debug("[run] Solana context result", {
          data: {
            result: ctx,
          },
        });
        return ctx;
      },
    });
  }
}
