import {
  ClearSignContextType,
  type ContextModule,
  isSolanaContextSuccess,
  SolanaTransactionScanChainId,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { GetPubKeyCommand } from "@internal/app-binder/command/GetPubKeyCommand";
import { DefaultSolanaMessageNormaliser } from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";
import { dispatchProvideContext } from "@internal/app-binder/task/context-providers/provideContextRegistry";
import { type ProvideContextDeps } from "@internal/app-binder/task/context-providers/provideContextTypes";

export type ProvideWeb3CheckTaskArgs = {
  readonly derivationPath: string;
  readonly transactionBytes: Uint8Array;
  readonly contextModule: ContextModule;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

/**
 * Fetches and streams the web3-checks (transaction scan) descriptor to the
 * device, independently of the clear-sign path taken. Best-effort: any failure
 * is logged and skipped so signing still proceeds.
 */
export class ProvideWeb3CheckTask {
  private readonly logger: LoggerPublisherService;

  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideWeb3CheckTaskArgs,
  ) {
    this.logger = args.loggerFactory("ProvideWeb3CheckTask");
  }

  async run(): Promise<void> {
    const pubKeyResult = await this.api.sendCommand(
      new GetPubKeyCommand({
        derivationPath: this.args.derivationPath,
        checkOnDevice: false,
      }),
    );
    if (!isSuccessCommandResult(pubKeyResult)) {
      this.logger.warn("[run] could not get public key; skipping web3-check");
      return;
    }

    const challengeResult = await this.api.sendCommand(
      new GetChallengeCommand(),
    );
    if (!isSuccessCommandResult(challengeResult)) {
      this.logger.warn("[run] GET CHALLENGE failed; skipping web3-check");
      return;
    }

    const contexts = await this.args.contextModule.getContexts(
      {
        deviceModelId: this.api.getDeviceSessionState().deviceModelId,
        challenge: challengeResult.data.challenge,
        transactionCheck: {
          from: pubKeyResult.data,
          transactionBytes: this.args.transactionBytes,
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      },
      [ClearSignContextType.SOLANA_TRANSACTION_CHECK],
    );

    const deps: ProvideContextDeps = {
      api: this.api,
      logger: this.logger,
      normaliser: new DefaultSolanaMessageNormaliser(),
      transactionBytes: this.args.transactionBytes,
    };
    for (const context of contexts) {
      if (
        context.type === ClearSignContextType.SOLANA_TRANSACTION_CHECK &&
        isSolanaContextSuccess(context)
      ) {
        await dispatchProvideContext(context, deps);
      }
    }
  }
}
