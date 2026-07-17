import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
  isSolanaContextSuccess,
  type SolanaAltResolutionContextSuccess,
  type SolanaTokenAccountStateContextSuccess,
  type SolanaTokenInfoContextSuccess,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
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
    const {
      tokenAccountStates,
      altResolutions,
      trustedNames,
      tokenAmountAltRefs,
      mintAltRefs,
    } = this.args.challengeBoundRequirements;

    // Track mints already streamed (from pre-fetched pool contexts) to avoid duplicates.
    const streamedMints = new Set<string>();
    for (const ctx of this.args.poolContexts) {
      if (
        ctx.type === ClearSignContextType.SOLANA_TOKEN_INFO &&
        isSolanaContextSuccess(ctx)
      ) {
        streamedMints.add((ctx as SolanaTokenInfoContextSuccess).payload.mint);
      }
    }

    for (const tokenAccount of tokenAccountStates) {
      const contexts = await this.provideChallengeBoundDescriptorAndReturn(
        (challenge) => ({
          deviceModelId,
          requests: [{ tokenAccount, challenge }],
        }),
        ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
      );
      for (const ctx of contexts) {
        if (
          ctx.type === ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE &&
          isSolanaContextSuccess(ctx)
        ) {
          const mint = (ctx as SolanaTokenAccountStateContextSuccess).payload
            .mint;
          if (mint && !streamedMints.has(mint)) {
            streamedMints.add(mint);
            await this.fetchAndStreamTokenInfo(mint, deviceModelId);
          }
        }
      }
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

    // ALT-backed MINT entries from MINT_ASSOCIATIONS. The device needs the
    // resolved mint pubkey at finalize (to build the MINT_ASSOC binding map),
    // so ALT_RESOLUTION is always streamed. TOKEN_INFO is attempted afterwards
    // for display purposes only, failure is silent (shows ??? but finalize passes).
    for (const { altAddress, entryIndex } of mintAltRefs) {
      const altContexts = await this.provideChallengeBoundDescriptorAndReturn(
        (challenge) => ({
          deviceModelId,
          requests: [{ altAddress, entryIndex, challenge }],
        }),
        ClearSignContextType.SOLANA_ALT_RESOLUTION,
      );
      for (const altCtx of altContexts) {
        if (
          altCtx.type !== ClearSignContextType.SOLANA_ALT_RESOLUTION ||
          !isSolanaContextSuccess(altCtx)
        )
          continue;
        const resolvedAddress = (altCtx as SolanaAltResolutionContextSuccess)
          .payload.resolvedAddress;
        if (resolvedAddress && !streamedMints.has(resolvedAddress)) {
          streamedMints.add(resolvedAddress);
          await this.fetchAndStreamTokenInfo(resolvedAddress, deviceModelId);
        }
      }
    }

    // ALT-backed PARAM_TOKEN_AMOUNT.TOKEN refs. The device needs the resolved
    // address at finalize (TOKEN_AMOUNT ACCOUNT_INDEX lookup via
    // pubkey_from_account_index), so ALT_RESOLUTION is always streamed.
    // After streaming, TOKEN_INFO is attempted (optimistic: address is a mint)
    // then TOKEN_ACCOUNT_STATE + TOKEN_INFO (fallback: address is an ATA).
    // If both fail, finalize still passes, the device will just show ???.
    for (const { altAddress, entryIndex } of tokenAmountAltRefs) {
      const altContexts = await this.provideChallengeBoundDescriptorAndReturn(
        (challenge) => ({
          deviceModelId,
          requests: [{ altAddress, entryIndex, challenge }],
        }),
        ClearSignContextType.SOLANA_ALT_RESOLUTION,
      );
      for (const altCtx of altContexts) {
        if (
          altCtx.type !== ClearSignContextType.SOLANA_ALT_RESOLUTION ||
          !isSolanaContextSuccess(altCtx)
        )
          continue;
        const resolvedAddress = (altCtx as SolanaAltResolutionContextSuccess)
          .payload.resolvedAddress;
        if (!resolvedAddress || streamedMints.has(resolvedAddress)) continue;

        // Optimistic: resolved address is a mint.
        const tokenInfoContexts = await this.args.contextModule.getContexts(
          { deviceModelId, mints: [resolvedAddress], network: this.network },
          [ClearSignContextType.SOLANA_TOKEN_INFO],
        );
        const tokenInfoCtx = tokenInfoContexts.find(
          (c) => c.type === ClearSignContextType.SOLANA_TOKEN_INFO,
        );
        if (tokenInfoCtx) {
          streamedMints.add(resolvedAddress);
          await this.provideDescriptor(tokenInfoCtx);
          continue;
        }

        // Fallback: resolved address may be an ATA, fetch TOKEN_ACCOUNT_STATE
        // to get the mint, then stream both if TOKEN_INFO is available.
        const stateCtx = await this.fetchChallengeBoundDescriptorOnly(
          (challenge) => ({
            deviceModelId,
            requests: [{ tokenAccount: resolvedAddress, challenge }],
          }),
          ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
        );
        if (!stateCtx || !isSolanaContextSuccess(stateCtx)) continue;

        const mint = (stateCtx as SolanaTokenAccountStateContextSuccess).payload
          .mint;
        if (!mint || streamedMints.has(mint)) continue;

        const mintTokenInfoContexts = await this.args.contextModule.getContexts(
          { deviceModelId, mints: [mint], network: this.network },
          [ClearSignContextType.SOLANA_TOKEN_INFO],
        );
        const mintTokenInfoCtx = mintTokenInfoContexts.find(
          (c) => c.type === ClearSignContextType.SOLANA_TOKEN_INFO,
        );
        if (!mintTokenInfoCtx) continue;

        await this.provideDescriptor(stateCtx);
        streamedMints.add(mint);
        await this.provideDescriptor(mintTokenInfoCtx);
      }
    }

    for (const address of trustedNames) {
      await this.provideChallengeBoundDescriptor(
        (challenge) => ({
          deviceModelId,
          network: this.network,
          // Only the CRYPTO_ASSET_LIST source is supported for now.
          requests: [{ address, challenge, sources: ["crypto_asset_list"] }],
        }),
        ClearSignContextType.SOLANA_TRUSTED_NAME,
      );
    }
  }

  /**
   * `GET CHALLENGE`, fetch the descriptor bound to it, but do NOT stream it.
   * Returns the first matching context so the caller can inspect the payload
   * and decide whether to stream it (via `provideDescriptor`).
   */
  private async fetchChallengeBoundDescriptorOnly(
    buildInput: (challenge: string) => unknown,
    type: ClearSignContextType,
  ): Promise<ClearSignContext | undefined> {
    const challengeResult = await this.api.sendCommand(
      new GetChallengeCommand(),
    );
    if (!isSuccessCommandResult(challengeResult)) {
      this.logger.warn("[run] GET CHALLENGE failed; skipping descriptor", {
        data: { type },
      });
      return undefined;
    }
    const contexts = await this.args.contextModule.getContexts(
      buildInput(challengeResult.data.challenge),
      [type],
    );
    return contexts.find((c) => c.type === type);
  }

  /**
   * `GET CHALLENGE`, fetch the descriptor, stream it, and return the matched
   * contexts so callers can inspect the payload (e.g. extract mint / resolvedAddress).
   */
  private async provideChallengeBoundDescriptorAndReturn(
    buildInput: (challenge: string) => unknown,
    type: ClearSignContextType,
  ): Promise<ClearSignContext[]> {
    const challengeResult = await this.api.sendCommand(
      new GetChallengeCommand(),
    );
    if (!isSuccessCommandResult(challengeResult)) {
      this.logger.warn("[run] GET CHALLENGE failed; skipping descriptor", {
        data: { type },
      });
      return [];
    }
    const contexts = await this.args.contextModule.getContexts(
      buildInput(challengeResult.data.challenge),
      [type],
    );
    const matched: ClearSignContext[] = [];
    for (const context of contexts) {
      if (context.type === type) {
        await this.provideDescriptor(context);
        matched.push(context);
      }
    }
    return matched;
  }

  /** `GET CHALLENGE`, then fetch the descriptor bound to it, then stream it (best-effort). */
  private async provideChallengeBoundDescriptor(
    buildInput: (challenge: string) => unknown,
    type: ClearSignContextType,
  ): Promise<void> {
    await this.provideChallengeBoundDescriptorAndReturn(buildInput, type);
  }

  /** Fetch TOKEN_INFO for `mint` from the context module and stream it to the device. */
  private async fetchAndStreamTokenInfo(
    mint: string,
    deviceModelId: DeviceModelId,
  ): Promise<void> {
    const contexts = await this.args.contextModule.getContexts(
      { deviceModelId, mints: [mint], network: this.network },
      [ClearSignContextType.SOLANA_TOKEN_INFO],
    );
    for (const ctx of contexts) {
      if (ctx.type === ClearSignContextType.SOLANA_TOKEN_INFO) {
        await this.provideDescriptor(ctx);
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
