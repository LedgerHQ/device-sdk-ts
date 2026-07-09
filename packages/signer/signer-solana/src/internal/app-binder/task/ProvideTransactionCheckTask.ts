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
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";
import { DefaultSolanaMessageNormaliser } from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";
import { dispatchProvideContext } from "@internal/app-binder/task/context-providers/provideContextRegistry";
import { type ProvideContextDeps } from "@internal/app-binder/task/context-providers/provideContextTypes";

export type ProvideTransactionCheckTaskArgs = {
  readonly derivationPath: string;
  readonly transactionBytes: Uint8Array;
  readonly contextModule: ContextModule;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
  /**
   * Whether the terminal sign will refresh the blockhash (delayed signing). The
   * device computes its transaction-check fingerprint over the exact message it signs:
   * the delayed path previews a blockhash-zeroed message, while the one-shot
   * path signs the original message. The scan descriptor must be fetched over
   * the matching bytes, so we only zero the blockhash when the sign will.
   */
  readonly isBlockhashRefreshNeeded: boolean;
  readonly blockhashService?: BlockhashService;
};

/**
 * Fetches and streams the transaction-checks (transaction scan) descriptor to the
 * device, independently of the clear-sign path taken. Best-effort: any failure
 * is logged and skipped so signing still proceeds.
 */
export class ProvideTransactionCheckTask {
  private readonly logger: LoggerPublisherService;
  private readonly blockhashService: BlockhashService;

  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideTransactionCheckTaskArgs,
  ) {
    this.logger = args.loggerFactory("ProvideTransactionCheckTask");
    this.blockhashService = args.blockhashService ?? new BlockhashService();
  }

  async run(): Promise<void> {
    const pubKeyResult = await this.api.sendCommand(
      new GetPubKeyCommand({
        derivationPath: this.args.derivationPath,
        checkOnDevice: false,
      }),
    );
    if (!isSuccessCommandResult(pubKeyResult)) {
      this.logger.warn(
        "[run] could not get public key; skipping transaction-check",
      );
      return;
    }

    const challengeResult = await this.api.sendCommand(
      new GetChallengeCommand(),
    );
    if (!isSuccessCommandResult(challengeResult)) {
      this.logger.warn(
        "[run] GET CHALLENGE failed; skipping transaction-check",
      );
      return;
    }

    // Fetch the scan descriptor over the exact bytes the device fingerprints:
    // the delayed path previews a blockhash-zeroed message, the one-shot path
    // signs the original. Mismatching makes the device show "Transaction Check
    // unavailable". Best-effort: if the blockhash can't be located, fall back to
    // the original (the signer degrades to a one-shot sign of it too).
    let transactionBytes = this.args.transactionBytes;
    if (this.args.isBlockhashRefreshNeeded) {
      try {
        transactionBytes = this.blockhashService.zeroBlockhash(
          this.args.transactionBytes,
        );
      } catch (error) {
        this.logger.debug(
          "[run] could not zero blockhash; using original transaction",
          { data: { error } },
        );
      }
    }

    const contexts = await this.args.contextModule.getContexts(
      {
        deviceModelId: this.api.getDeviceSessionState().deviceModelId,
        challenge: challengeResult.data.challenge,
        transactionCheck: {
          from: pubKeyResult.data,
          transactionBytes,
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
