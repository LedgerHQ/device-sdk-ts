import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type LoaderResult,
  type SolanaTransactionContextResultSuccess,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type TransactionResolutionContext } from "@api/model/TransactionResolutionContext";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

export type { SolanaTransactionContextResultSuccess as BasicClearSignContext };

export type BuildBasicClearSignContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly options: TransactionResolutionContext;
  readonly transactionBytes: Uint8Array;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

export class BuildBasicClearSignContextTask {
  private readonly _logger: LoggerPublisherService;
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildBasicClearSignContextTaskArgs,
  ) {
    this._logger = args.loggerFactory("BuildBasicClearSignContextTask");
  }

  async run(): Promise<SolanaTransactionContextResultSuccess> {
    this._logger.debug("[run] Starting BuildBasicClearSignContextTask");
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
    this._logger.debug("[run] Calling contextModule.getContexts for Solana", {
      data: {
        args: contextModuleGetSolanaContextArgs,
      },
    });

    const contexts = await contextModule.getContexts(
      contextModuleGetSolanaContextArgs,
      [
        ClearSignContextType.SOLANA_TOKEN,
        ClearSignContextType.SOLANA_LIFI,
        ClearSignContextType.SOLANA_TRUSTED_NAME,
      ],
    );

    this._logger.debug("[run] Solana context result", {
      data: { contexts },
    });

    const contextErrorCount = contexts.filter(
      (contextResponseItem) =>
        contextResponseItem.type === ClearSignContextType.ERROR,
    ).length;

    const trustedNameCtx = contexts.find(
      (
        contextResponseItem,
      ): contextResponseItem is ClearSignContextSuccess<ClearSignContextType.SOLANA_TRUSTED_NAME> =>
        contextResponseItem.type === ClearSignContextType.SOLANA_TRUSTED_NAME,
    );
    const trustedNamePKICertificate = trustedNameCtx?.certificate;
    const tlvDescriptor = trustedNameCtx?.payload;

    const ownerInfoRequired = !!(options.tokenAddress || options.createATA);
    if (ownerInfoRequired && trustedNameCtx === undefined) {
      throw new Error(
        "[SignerSolana] BuildBasicClearSignContextTask: owner info was required but could not be resolved",
      );
    }

    const loadersResults = contexts.filter(
      (contextResponseItem): contextResponseItem is LoaderResult =>
        contextResponseItem.type === ClearSignContextType.ERROR ||
        contextResponseItem.type === ClearSignContextType.SOLANA_TOKEN ||
        contextResponseItem.type === ClearSignContextType.SOLANA_LIFI,
    );

    return {
      trustedNamePKICertificate,
      tlvDescriptor,
      loadersResults,
      contextErrorCount,
    };
  }
}
