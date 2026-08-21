import {
  ClearSignContextType,
  type ContextModule,
  isSolanaContextSuccess,
  type SolanaTransactionContextResultSuccess,
} from "@ledgerhq/context-module";
import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
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

  async run(): Promise<CommandResult<SolanaTransactionContextResultSuccess>> {
    this._logger.debug("[run] Starting BuildBasicClearSignContextTask");
    const { contextModule, options } = this.args;
    const deviceState = this.api.getDeviceSessionState();

    // get challenge
    const challengeRes = await this.api.sendCommand(new GetChallengeCommand());
    if (!isSuccessCommandResult(challengeRes)) {
      this._logger.error("[run] GET CHALLENGE failed", {
        data: { error: challengeRes.error },
      });
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Failed to get challenge from device",
        ),
      });
    }
    const challenge = challengeRes.data.challenge;

    const contextModuleGetSolanaContextArgs = {
      deviceModelId: deviceState.deviceModelId,
      tokenAddress: options.tokenAddress,
      challenge,
      createATA: options.createATA,
      mintAddress: options.mintAddress,
      tokenInternalId: options.tokenInternalId,
      templateId: options.templateId,
    };
    // get Solana context
    this._logger.debug("[run] Calling contextModule.getContexts for Solana", {
      data: {
        deviceModelId: contextModuleGetSolanaContextArgs.deviceModelId,
        hasChallenge: !!contextModuleGetSolanaContextArgs.challenge,
        hasTokenAddress: !!contextModuleGetSolanaContextArgs.tokenAddress,
        hasMintAddress: !!contextModuleGetSolanaContextArgs.mintAddress,
        createATA: contextModuleGetSolanaContextArgs.createATA,
      },
    });

    const contexts = await contextModule.getContexts(
      contextModuleGetSolanaContextArgs,
      [
        ClearSignContextType.SOLANA_TOKEN,
        ClearSignContextType.SOLANA_LIFI,
        ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME,
      ],
    );

    this._logger.debug("[run] Solana context result", {
      data: {
        contexts: contexts.map((c) => ({
          type: c.type,
          failed: c.type === ClearSignContextType.ERROR,
        })),
      },
    });

    const contextErrorCount = contexts.filter(
      (contextResponseItem) =>
        contextResponseItem.type === ClearSignContextType.ERROR,
    ).length;

    const ownerInfoRequired = !!(options.tokenAddress || options.createATA);
    if (
      ownerInfoRequired &&
      !contexts.some(
        (c) => c.type === ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME,
      )
    ) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "[SignerSolana] BuildBasicClearSignContextTask: owner info was required but could not be resolved",
        ),
      });
    }

    return CommandResultFactory({
      data: {
        loadersResults: contexts.filter(isSolanaContextSuccess),
        contextErrorCount,
      },
    });
  }
}
