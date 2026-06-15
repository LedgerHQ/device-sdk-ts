import {
  type ClearSignContextSuccess,
  ClearSignContextType,
  type ContextModule,
  type LoaderResult,
  type SolanaTransactionContextResultSuccess,
  SolanaTransactionScanChainId,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type TransactionResolutionContext } from "@api/model/TransactionResolutionContext";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";

export type { SolanaTransactionContextResultSuccess as ShallowClearSignContext };

export type BuildShallowClearSignContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly options: TransactionResolutionContext;
  readonly transactionBytes: Uint8Array;
  readonly signerAddress: string | null;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

export class BuildShallowClearSignContextTask {
  private readonly _logger: LoggerPublisherService;
  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildShallowClearSignContextTaskArgs,
  ) {
    this._logger = args.loggerFactory("BuildShallowClearSignContextTask");
  }

  async run(): Promise<SolanaTransactionContextResultSuccess> {
    this._logger.debug("[run] Starting BuildShallowClearSignContextTask");
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

    const transactionCheck = this.args.signerAddress
      ? {
          from: this.args.signerAddress,
          transactionBytes: this.args.transactionBytes,
          chain: SolanaTransactionScanChainId.MAINNET,
        }
      : undefined;

    const contextModuleGetSolanaContextArgs = {
      deviceModelId: deviceState.deviceModelId,
      tokenAddress: options.tokenAddress,
      challenge,
      createATA: options.createATA,
      tokenInternalId: options.tokenInternalId,
      templateId: options.templateId,
      transactionCheck,
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
        // !! TODO-WEB3CHECK FLIP THIS BACK ONCE TRANSACTION CHECK IS READY,
        // TO BE KEEPT OFF FOR NOW
        //ClearSignContextType.SOLANA_TRANSACTION_CHECK,
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
        "[SignerSolana] BuildShallowClearSignContextTask: owner info was required but could not be resolved",
      );
    }

    const loadersResults = contexts.filter(
      (contextResponseItem): contextResponseItem is LoaderResult =>
        contextResponseItem.type === ClearSignContextType.ERROR ||
        contextResponseItem.type === ClearSignContextType.SOLANA_TOKEN ||
        contextResponseItem.type === ClearSignContextType.SOLANA_LIFI ||
        contextResponseItem.type ===
          ClearSignContextType.SOLANA_TRANSACTION_CHECK,
    );

    return {
      trustedNamePKICertificate,
      tlvDescriptor,
      loadersResults,
      contextErrorCount,
    };
  }
}
