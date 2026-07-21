import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
  isSolanaContextSuccess,
} from "@ledgerhq/context-module";
import {
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { SignMessageGenericPreviewCommand } from "@internal/app-binder/command/SignMessageGenericPreviewCommand";
import { BlockhashService } from "@internal/app-binder/services/BlockhashService";
import {
  DefaultSolanaMessageNormaliser,
  type SolanaMessageNormaliser,
} from "@internal/app-binder/services/utils/DefaultSolanaMessageNormaliser";
import {
  type ChallengeBoundRequirements,
  DEFAULT_NETWORK,
} from "@internal/app-binder/task/BuildGenericClearSignContextTask";
import { dispatchProvideContext } from "@internal/app-binder/task/context-providers/provideContextRegistry";
import { type ProvideContextDeps } from "@internal/app-binder/task/context-providers/provideContextTypes";
import { SignDataTask } from "@internal/app-binder/task/SendSignDataTask";

/**
 * Descriptor types whose provisioning failure must abort generic clear-signing
 * (the caller then falls back to the legacy basic path). These carry the
 * structural information the device needs to interpret the instructions at all,
 * so without them there is nothing to clear-sign.
 *
 * Every other descriptor type (token info, token account state, ALT resolution,
 * trusted name, …) is best-effort: a failure only degrades the UX for that one
 * piece of metadata, so it is swallowed and the remaining descriptors are still
 * streamed. Degraded clear-signing beats falling back to blind/basic signing.
 */
const FATAL_PROVIDE_CONTEXT_TYPES: ReadonlySet<ClearSignContextType> = new Set([
  ClearSignContextType.SOLANA_INSTRUCTION_INFO,
  ClearSignContextType.SOLANA_ENUM_VARIANT,
]);

export type ProvideGenericClearSignContextTaskArgs = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  /** Non-challenge-bound Phase A pool descriptors, already fetched by the build task. */
  readonly poolContexts: ClearSignContext[];
  /** Phase B instruction templates, already fetched by the build task. */
  readonly instructionInfoContexts: ClearSignContext[];
  /** Challenge-bound Phase A requirements, fetched (with a fresh challenge each) here. */
  readonly challengeBoundRequirements: ChallengeBoundRequirements;
  readonly contextModule: ContextModule;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
  readonly network?: string;
  readonly normaliser?: SolanaMessageNormaliser;
  readonly blockhashService?: BlockhashService;
};

/**
 * Streams the generic clear-sign context to the device in the mandated order:
 * `SIGN MESSAGE GENERIC PREVIEW` (0x0A) then Phase A pool then Phase B
 * templates, stopping before `PROMPT UI DISPLAY` (a separate, user-interaction
 * step). The non-challenge-bound pool and the templates are pre-fetched by the
 * build task; the challenge-bound descriptors are fetched here, each preceded
 * by a fresh `GET CHALLENGE` issued immediately before it is streamed (the
 * device consumes the challenge per descriptor). Per-descriptor provisioning is
 * delegated to the shared {@link dispatchProvideContext} registry.
 */
export class ProvideGenericClearSignContextTask {
  private readonly logger: LoggerPublisherService;
  private readonly deps: ProvideContextDeps;
  private readonly network: string;
  private readonly blockhashService: BlockhashService;

  constructor(
    private readonly api: InternalApi,
    private readonly args: ProvideGenericClearSignContextTaskArgs,
  ) {
    this.logger = args.loggerFactory("ProvideGenericClearSignContextTask");
    this.network = args.network ?? DEFAULT_NETWORK;
    this.blockhashService = args.blockhashService ?? new BlockhashService();
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
      await this.provideDescriptor(context);
    }
    await this.streamChallengeBoundDescriptors();
    for (const context of this.args.instructionInfoContexts) {
      await this.provideDescriptor(context);
    }
  }

  /**
   * Streams a single descriptor to the device. Failures of a
   * {@link FATAL_PROVIDE_CONTEXT_TYPES} descriptor propagate (aborting generic
   * clear-signing); any other descriptor's failure is swallowed so the device
   * can still clear-sign the rest with degraded UX.
   */
  private async provideDescriptor(context: ClearSignContext): Promise<void> {
    if (!isSolanaContextSuccess(context)) {
      return;
    }
    if (FATAL_PROVIDE_CONTEXT_TYPES.has(context.type)) {
      await dispatchProvideContext(context, this.deps);
      return;
    }
    try {
      await dispatchProvideContext(context, this.deps);
    } catch (error) {
      this.logger.warn(
        "[run] optional descriptor provisioning failed; continuing with degraded clear-signing",
        { data: { type: context.type, error } },
      );
    }
  }

  /** Challenge-bound Phase A descriptors (token-account-state, ALT, trusted-name). */
  private async streamChallengeBoundDescriptors(): Promise<void> {
    const deviceModelId = this.api.getDeviceSessionState().deviceModelId;
    const { tokenAccountStates, altResolutions, trustedNames } =
      this.args.challengeBoundRequirements;

    for (const tokenAccount of tokenAccountStates) {
      await this.provideChallengeBoundDescriptor(
        (challenge) => ({
          deviceModelId,
          requests: [{ tokenAccount, challenge }],
        }),
        ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
      );
    }
    for (const { altAddress, entryIndex } of altResolutions) {
      await this.provideChallengeBoundDescriptor(
        (challenge) => ({
          deviceModelId,
          requests: [{ altAddress, entryIndex, challenge }],
        }),
        ClearSignContextType.SOLANA_ALT_RESOLUTION,
      );
    }
    for (const address of trustedNames) {
      await this.provideChallengeBoundDescriptor(
        (challenge) => ({
          deviceModelId,
          network: this.network,
          // Only the TOKEN / SMART_CONTRACT types and the CRYPTO_ASSET_LIST
          // source are supported for now.
          requests: [
            {
              address,
              challenge,
              types: ["token", "smart_contract"],
              sources: ["crypto_asset_list"],
            },
          ],
        }),
        ClearSignContextType.SOLANA_TRUSTED_NAME,
      );
    }
  }

  /** `GET CHALLENGE`, then fetch the descriptor bound to it, then stream it (best-effort). */
  private async provideChallengeBoundDescriptor(
    buildInput: (challenge: string) => unknown,
    type: ClearSignContextType,
  ): Promise<void> {
    const challengeResult = await this.api.sendCommand(
      new GetChallengeCommand(),
    );
    if (!isSuccessCommandResult(challengeResult)) {
      this.logger.warn("[run] GET CHALLENGE failed; skipping descriptor", {
        data: { type },
      });
      return;
    }
    const contexts = await this.args.contextModule.getContexts(
      buildInput(challengeResult.data.challenge),
      [type],
    );
    for (const context of contexts) {
      if (context.type === type) {
        await this.provideDescriptor(context);
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
      previewTransaction = this.blockhashService.zeroBlockhash(
        this.args.transaction,
      );
    } catch (error) {
      this.logger.debug(
        "[streamGenericPreview] could not zero blockhash; streaming original",
        { data: { error } },
      );
    }

    const result = await new SignDataTask<void>(this.api, {
      derivationPath: this.args.derivationPath,
      sendingData: previewTransaction,
      commandFactory: (chunkArgs) =>
        new SignMessageGenericPreviewCommand({
          serializedMessage: chunkArgs.chunkedData,
          isFirstChunk: !chunkArgs.extend,
          hasMore: chunkArgs.more,
        }),
      loggerFactory: this.args.loggerFactory,
    }).run();

    if (!isSuccessCommandResult(result)) {
      throw new Error(
        "[ProvideGenericClearSignContextTask] device rejected SIGN MESSAGE GENERIC PREVIEW",
      );
    }
  }
}
