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
import { DefaultSolanaTransactionSerializer } from "@internal/app-binder/services/DefaultSolanaTransactionSerializer";
import { type SolanaTransactionSerializer } from "@internal/app-binder/services/SolanaTransactionSerializer";
import { DefaultSolanaMessageNormaliser } from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";
import { dispatchProvideContext } from "@internal/app-binder/task/context-providers/provideContextRegistry";
import { type ProvideContextDeps } from "@internal/app-binder/task/context-providers/provideContextTypes";

export type ProvideTransactionCheckTaskArgs = {
  readonly derivationPath: string;
  readonly transactionBytes: Uint8Array;
  readonly contextModule: ContextModule;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
  readonly serializedTransactionForTransactionCheck?: Uint8Array;
  readonly transactionSerializer?: SolanaTransactionSerializer;
};

/**
 * Fetches and streams the transaction-checks (transaction scan) descriptor to the
 * device, independently of the clear-sign path taken. Best-effort: any failure
 * is logged and skipped so signing still proceeds.
 */
export class ProvideTransactionCheckTask {
  private readonly logger: LoggerPublisherService;
  private readonly transactionSerializer: SolanaTransactionSerializer;

  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideTransactionCheckTaskArgs,
  ) {
    this.logger = args.loggerFactory("ProvideTransactionCheckTask");
    this.transactionSerializer =
      args.transactionSerializer ?? new DefaultSolanaTransactionSerializer();
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

    // The device checks the report's TX_HASH against the exact message it
    // reviews (as streamed at preview / generic session start), blockhash
    // included, so the scan is fetched over the original bytes. A later
    // delayed-sign blockhash refresh does not matter here: the device leaves the
    // blockhash out of its own preview / delayed-sign fingerprint.
    const wrappedTransactionBytes =
      this.transactionSerializer.wrapMessageAsTransaction(
        this.args.transactionBytes,
        this.args.serializedTransactionForTransactionCheck,
      );

    const contexts = await this.args.contextModule.getContexts(
      {
        deviceModelId: this.api.getDeviceSessionState().deviceModelId,
        challenge: challengeResult.data.challenge,
        transactionCheck: {
          from: pubKeyResult.data,
          transactionBytes: wrappedTransactionBytes,
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
        const result = await dispatchProvideContext(context, deps);
        // Best-effort per the class contract above: log the rejection but keep
        // signing proceeding rather than aborting.
        if (!isSuccessCommandResult(result)) {
          this.logger.warn(
            "[run] device rejected transaction-check; continuing without it",
            { data: { error: result.error } },
          );
        }
      }
    }
  }
}
