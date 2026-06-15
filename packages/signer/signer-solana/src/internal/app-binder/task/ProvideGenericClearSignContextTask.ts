import {
  type ClearSignContext,
  ClearSignContextType,
  isSolanaContextSuccess,
} from "@ledgerhq/context-module";
import {
  ByteArrayBuilder,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import {
  DerivationPathUtils,
  SendCommandInChunksTask,
} from "@ledgerhq/signer-utils";

import { SignMessageGenericPreviewCommand } from "@internal/app-binder/command/SignMessageGenericPreviewCommand";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";
import {
  DefaultSolanaMessageNormaliser,
  type SolanaMessageNormaliser,
} from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";
import { dispatchProvideContext } from "@internal/app-binder/task/context-providers/provideContextRegistry";
import { type ProvideContextDeps } from "@internal/app-binder/task/context-providers/provideContextTypes";

export type ProvideGenericClearSignContextTaskArgs = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  /** Phase A pool descriptors, already fetched by the build task. */
  readonly poolContexts: ClearSignContext[];
  /** Phase B instruction templates, already fetched by the build task. */
  readonly instructionInfoContexts: ClearSignContext[];
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
  readonly normaliser?: SolanaMessageNormaliser;
};

/**
 * Streams the pre-built generic clear-sign context to the device in the
 * mandated order: `SIGN MESSAGE GENERIC PREVIEW` (0x0A) → Phase A pool → Phase B
 * templates, stopping before `PROMPT UI DISPLAY` (a separate, user-interaction
 * step). Per-descriptor provisioning is delegated to the shared
 * {@link dispatchProvideContext} registry.
 */
export class ProvideGenericClearSignContextTask {
  private readonly logger: LoggerPublisherService;
  private readonly deps: ProvideContextDeps;

  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideGenericClearSignContextTaskArgs,
  ) {
    this.logger = args.loggerFactory("ProvideGenericClearSignContextTask");
    this.deps = {
      api,
      logger: this.logger,
      normaliser: args.normaliser ?? new DefaultSolanaMessageNormaliser(),
      transactionBytes: args.transaction,
    };
  }

  async run(): Promise<void> {
    await this.streamGenericPreview();
    // Phase A pool, then Phase B templates. Order within Phase A is
    // device-agnostic; templates come last so the device can run the merge.
    for (const context of this.args.poolContexts) {
      if (isSolanaContextSuccess(context)) {
        await dispatchProvideContext(context, this.deps);
      }
    }
    for (const context of this.args.instructionInfoContexts) {
      if (context.type === ClearSignContextType.SOLANA_INSTRUCTION_INFO) {
        await dispatchProvideContext(context, this.deps);
      }
    }
  }

  /** 0x0A — derivation path + serialized TX, chunked. No length prefix. */
  private async streamGenericPreview(): Promise<void> {
    // The device arms its fingerprint over the message with the blockhash
    // zeroed, so the preview streams a zeroed-blockhash copy; the real (or
    // freshly fetched) blockhash is supplied later at SIGN MESSAGE DELAYED.
    // Best-effort: if the blockhash can't be located we stream the original
    // (the device zeroes it anyway when computing the fingerprint).
    let previewTransaction = this.args.transaction;
    try {
      previewTransaction = new BlockhashService().zeroBlockhash(
        this.args.transaction,
      );
    } catch (error) {
      this.logger.debug(
        "[streamGenericPreview] could not zero blockhash; streaming original",
        { data: { error } },
      );
    }

    const paths = DerivationPathUtils.splitPath(this.args.derivationPath);
    const builder = new ByteArrayBuilder(
      previewTransaction.length + 2 + paths.length * 4,
    );
    builder.add8BitUIntToData(1); // number of signers
    builder.add8BitUIntToData(paths.length);
    paths.forEach((path) => builder.add32BitUIntToData(path));
    builder.addBufferToData(previewTransaction);

    const result = await new SendCommandInChunksTask<void, SolanaAppErrorCodes>(
      this.api,
      {
        data: builder.build(),
        commandFactory: (chunkArgs) =>
          new SignMessageGenericPreviewCommand({
            serializedMessage: chunkArgs.chunkedData,
            isFirstChunk: !chunkArgs.extend,
            hasMore: chunkArgs.more,
          }),
      },
    ).run();

    if (!isSuccessCommandResult(result)) {
      throw new Error(
        "[ProvideGenericClearSignContextTask] device rejected SIGN MESSAGE GENERIC PREVIEW",
      );
    }
  }
}
