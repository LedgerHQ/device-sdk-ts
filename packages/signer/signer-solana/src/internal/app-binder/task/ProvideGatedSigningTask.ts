import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
  isSolanaContextSuccess,
  type SolanaGatedSigningContextSuccess,
} from "@ledgerhq/context-module";
import {
  type DmkError,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
  UnknownDAError,
} from "@ledgerhq/device-management-kit";
import { type Either, Left, Right } from "purify-ts";

import { DefaultSolanaMessageNormaliser } from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";
import { topLevelInstructions } from "@internal/app-binder/services/utils/topLevelInstructions";
import { TransactionParser } from "@internal/app-binder/services/utils/TransactionParser";
import { dispatchProvideContext } from "@internal/app-binder/task/context-providers/provideContextRegistry";

export type ProvideGatedSigningTaskArgs = {
  /** Message bytes, as streamed to the device for signing. */
  readonly transactionBytes: Uint8Array;
  readonly contextModule: ContextModule;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
  /**
   * A descriptor an earlier run already sent. It is sent again as is, with no
   * new CAL lookup (the re-send after a failed generic clear-sign attempt).
   */
  readonly context?: SolanaGatedSigningContextSuccess;
};

/**
 * Right: the descriptor the device accepted, or null when none applies.
 * Left: the lookup or the device failed; signing goes on without gating.
 */
export type ProvideGatedSigningTaskResult = Either<
  DmkError,
  SolanaGatedSigningContextSuccess | null
>;

/**
 * Sends the gating descriptor that applies to the transaction, if any, before
 * the transaction itself. Never throws: every failure is a Left, so signing
 * still proceeds.
 *
 * Only top-level instructions count, with a program ID read from the static
 * account keys, as on the device.
 */
export class ProvideGatedSigningTask {
  private readonly logger: LoggerPublisherService;

  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideGatedSigningTaskArgs,
  ) {
    this.logger = args.loggerFactory("ProvideGatedSigningTask");
  }

  async run(): Promise<ProvideGatedSigningTaskResult> {
    const found = this.args.context
      ? Right(this.args.context)
      : await this.findContext();

    if (found.isLeft()) {
      this.logger.warn("[run] gating lookup failed; signing without it", {
        data: { error: found.extract() },
      });
      return found;
    }
    const context = found.unsafeCoerce();
    if (context === null) return Right(null);

    const result = await dispatchProvideContext(context, {
      api: this.api,
      logger: this.logger,
      normaliser: new DefaultSolanaMessageNormaliser(),
      transactionBytes: this.args.transactionBytes,
    });
    if (!isSuccessCommandResult(result)) {
      this.logger.warn(
        "[run] device rejected the gating descriptor; signing without it",
        { data: { error: result.error } },
      );
      return Left(result.error);
    }
    return Right(context);
  }

  private async findContext(): Promise<
    Either<DmkError, SolanaGatedSigningContextSuccess | null>
  > {
    const parsed = await new TransactionParser()
      .parse(this.args.transactionBytes)
      .run();
    if (parsed.isLeft()) return Left(parsed.extract());

    const instructions = topLevelInstructions(parsed.unsafeCoerce().message);
    if (instructions.length === 0) return Right(null);

    let contexts: ClearSignContext[];
    try {
      contexts = await this.args.contextModule.getContexts(
        {
          deviceModelId: this.api.getDeviceSessionState().deviceModelId,
          gatedSigning: { instructions },
        },
        [ClearSignContextType.SOLANA_GATED_SIGNING],
      );
    } catch (error) {
      return Left(new UnknownDAError(`Gating lookup threw: ${String(error)}`));
    }

    // One gating descriptor per transaction.
    for (const context of contexts) {
      if (
        context.type === ClearSignContextType.SOLANA_GATED_SIGNING &&
        isSolanaContextSuccess(context)
      ) {
        return Right(context);
      }
    }
    for (const context of contexts) {
      if (context.type === ClearSignContextType.ERROR) {
        return Left(new UnknownDAError(context.error.message));
      }
    }
    return Right(null);
  }
}
