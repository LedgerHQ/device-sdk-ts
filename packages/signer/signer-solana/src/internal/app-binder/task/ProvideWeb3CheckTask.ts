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

    // The device arms its web3-check fingerprint over the message with the
    // blockhash zeroed (the real/freshly fetched blockhash is supplied later at
    // SIGN MESSAGE DELAYED). The scan descriptor must therefore be fetched over
    // the same zeroed-blockhash bytes, otherwise the device cannot match the
    // verdict to the transaction it signs and shows "Transaction Check
    // unavailable". Best-effort: if the blockhash can't be located we fall back
    // to the original (the device zeroes it anyway when computing the
    // fingerprint).
    let transactionBytes = this.args.transactionBytes;
    try {
      transactionBytes = new BlockhashService().zeroBlockhash(
        this.args.transactionBytes,
      );
    } catch (error) {
      this.logger.debug(
        "[run] could not zero blockhash; using original transaction",
        { data: { error } },
      );
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
