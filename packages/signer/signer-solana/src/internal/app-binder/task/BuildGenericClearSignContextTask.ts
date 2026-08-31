import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
  type SolanaInstructionInfoPayload,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
  hexaStringToBuffer,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type ClearSignMode } from "@api/app-binder/SignTransactionDeviceActionTypes";
import {
  buildEnumCache,
  type VariantCache,
} from "@internal/app-binder/clear-sign/idl-type-pool";
import {
  type AltEntryKey,
  buildRequirements,
  type BuildRequirementsOptions,
  type DescriptorRequirements,
  type InstructionDescriptor,
  type MatchedInstruction,
  type RequirementAccount,
} from "@internal/app-binder/clear-sign/requirements";
import { COMPUTE_BUDGET_PROGRAM_ID } from "@internal/app-binder/constants";
import { type NormalizedMessage } from "@internal/app-binder/services/TransactionInspector";
import { TransactionParser } from "@internal/app-binder/services/utils/TransactionParser";

export const DEFAULT_NETWORK = "solana-mainnet";
const EMPTY_ENUM_CACHE: VariantCache = new Map();

/** Challenge-bound requirements, fetched one at a time in the provide phase. */
export type ChallengeBoundRequirements = Pick<
  DescriptorRequirements,
  "tokenAccountStates" | "altResolutions" | "trustedNames"
> & {
  /** ALT-backed PARAM_TOKEN_AMOUNT.TOKEN refs needing TOKEN_INFO-first resolution. */
  tokenAmountAltRefs: AltEntryKey[];
  /** ALT-backed MINT entries from MINT_ASSOCIATIONS; require TOKEN_INFO via hold-and-conditionally-stream. */
  mintAltRefs: AltEntryKey[];
};

/**
 * Everything the device needs to clear-sign a transaction, gathered host-side.
 * The non-challenge-bound descriptors are pre-fetched here; the challenge-bound
 * ones are carried as requirements and fetched+streamed by the provide phase.
 */
export type GenericClearSignContext = {
  /** `full` (merge) / `srfc39-only` (partial) / `none` (legacy fallback). */
  readonly mode: ClearSignMode;
  /** Phase A pool descriptors that need no challenge (token-info, enum-variant). */
  readonly poolContexts: ClearSignContext[];
  /** Phase B templates: one SOLANA_INSTRUCTION_INFO per matched (programId, discriminator). */
  readonly instructionInfoContexts: ClearSignContext[];
  /** Challenge-bound Phase A requirements, fetched+streamed in the provide phase. */
  readonly challengeBoundRequirements: ChallengeBoundRequirements;
  /** Programs that had no matching CAL descriptor. */
  readonly unrecognizedProgramIds: string[];
};

export type BuildGenericClearSignContextTaskArgs = {
  readonly contextModule: ContextModule;
  readonly transaction: Uint8Array;
  readonly deviceModelId: DeviceModelId;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
  readonly network?: string;
  /** Enum-variant decoder override; defaults to the real type-pool decoder. */
  readonly selectEnumVariants?: BuildRequirementsOptions["selectEnumVariants"];
};

/**
 * Groups the whole host-side preparation for generic clear-signing: parse the
 * TX (raw ALT refs preserved), skip ComputeBudget, look up CAL
 * `INSTRUCTION_INFO` per remaining program, match discriminators, build the
 * requirement set, and pre-fetch the non-challenge-bound satellite descriptors.
 * Challenge-bound descriptors are NOT fetched here — each needs a fresh
 * `GET CHALLENGE` issued immediately before it is streamed, so they are carried
 * forward as requirements and resolved by the provide task.
 */
export class BuildGenericClearSignContextTask {
  private readonly logger: LoggerPublisherService;
  private readonly network: string;

  constructor(private readonly args: BuildGenericClearSignContextTaskArgs) {
    this.logger = args.loggerFactory("BuildGenericClearSignContextTask");
    this.network = args.network ?? DEFAULT_NETWORK;
  }

  async run(): Promise<GenericClearSignContext> {
    const none: GenericClearSignContext = {
      mode: "none",
      poolContexts: [],
      instructionInfoContexts: [],
      challengeBoundRequirements: {
        tokenAccountStates: [],
        altResolutions: [],
        trustedNames: [],
        tokenAmountAltRefs: [],
        mintAltRefs: [],
      },
      unrecognizedProgramIds: [],
    };

    // --- Parse + CAL lookup + match (Stage 1) ---
    const parsed = await new TransactionParser(undefined, {
      preserveAltRefs: true,
    })
      .parse(this.args.transaction)
      .run();
    if (parsed.isLeft()) {
      this.logger.warn("[run] parse failed; falling back to legacy", {
        data: { error: parsed.extract() },
      });
      return none;
    }
    const message = parsed.unsafeCoerce().message;

    const remaining = message.compiledInstructions
      .map((ix) => ({
        ix,
        programId: this.programIdOf(message, ix.programIdIndex),
      }))
      .filter(({ programId }) => programId !== COMPUTE_BUDGET_PROGRAM_ID);
    if (remaining.length === 0) {
      this.logTransactionInstructions(message, new Map(), [], 0);
      return none;
    }

    const distinctProgramIds = Array.from(
      new Set(remaining.map((r) => r.programId)),
    );
    const infoContexts = await this.args.contextModule.getContexts(
      {
        deviceModelId: this.args.deviceModelId,
        instructions: distinctProgramIds.map((programId) => ({ programId })),
        network: this.network,
      },
      [ClearSignContextType.SOLANA_INSTRUCTION_INFO],
    );

    const byProgram = new Map<
      string,
      { payload: SolanaInstructionInfoPayload; context: ClearSignContext }[]
    >();
    for (const context of infoContexts) {
      if (context.type !== ClearSignContextType.SOLANA_INSTRUCTION_INFO)
        continue;
      const list = byProgram.get(context.payload.programId) ?? [];
      list.push({ payload: context.payload, context });
      byProgram.set(context.payload.programId, list);
    }

    const matched: MatchedInstruction[] = [];
    const templateByKey = new Map<string, ClearSignContext>();
    const unrecognizedProgramIds: string[] = [];
    for (const { ix, programId } of remaining) {
      // Prefer the most specific match: a discriminator-less descriptor
      // matches any data of its program, so it must not shadow a descriptor
      // that pins actual leading bytes.
      const candidate = (byProgram.get(programId) ?? [])
        .filter(({ payload }) =>
          this.discriminatorMatches(payload.discriminator, ix.data),
        )
        .sort(
          (a, b) =>
            b.payload.discriminator.length - a.payload.discriminator.length,
        )[0];
      const descriptor = candidate
        ? this.toInstructionDescriptor(candidate.payload)
        : null;
      if (!candidate || !descriptor) {
        unrecognizedProgramIds.push(programId);
        continue;
      }
      matched.push({
        instruction: {
          programId,
          accounts: this.toRequirementAccounts(
            message,
            ix.accountKeyIndexes,
            ix.accountWritable,
          ),
          data: ix.data,
        },
        descriptor,
      });
      templateByKey.set(
        `${programId}:${candidate.payload.discriminator}`,
        candidate.context,
      );
    }

    this.logTransactionInstructions(
      message,
      byProgram,
      matched,
      unrecognizedProgramIds.length,
    );

    if (matched.length === 0) {
      return {
        ...none,
        unrecognizedProgramIds: [...new Set(unrecognizedProgramIds)],
      };
    }

    const instructionInfoContexts = Array.from(templateByKey.values());

    // The device requires every non-ComputeBudget instruction to have a
    // template at FINALIZE (cs_transaction_finalize walks all instructions).
    // Any unrecognized instruction guarantees 6d20 so cs_transaction_reset() and
    // basic sign to 6808 (blind signing disabled). Bail out early so basic sign
    // starts from a clean device state.
    if (unrecognizedProgramIds.length > 0) {
      this.logger.warn(
        "[run] transaction has unrecognized instructions; falling back to legacy",
        {
          data: {
            unrecognized: unrecognizedProgramIds.length,
            recognized: matched.length,
          },
        },
      );
      return {
        ...none,
        unrecognizedProgramIds: [...new Set(unrecognizedProgramIds)],
      };
    }
    const mode: ClearSignMode = "full";

    // --- Requirements (Stage 2) ---
    const requirementsResult = buildRequirements(matched, {
      selectEnumVariants: this.args.selectEnumVariants,
    });
    if (requirementsResult.isLeft()) {
      this.logger.warn("[run] requirement build failed; falling back", {
        data: { error: requirementsResult.extract() },
      });
      return { ...none, unrecognizedProgramIds: [] };
    }
    const requirements = requirementsResult.unsafeCoerce();

    // --- Fetch non-challenge-bound satellites (Stage 3) ---
    const poolContexts: ClearSignContext[] = [];
    if (requirements.tokenInfos.length > 0) {
      poolContexts.push(
        ...(await this.getContextsByType(
          {
            deviceModelId: this.args.deviceModelId,
            mints: requirements.tokenInfos,
            network: this.network,
          },
          ClearSignContextType.SOLANA_TOKEN_INFO,
        )),
      );
    }
    poolContexts.push(
      ...this.selectedEnumVariants(
        requirements.enumVariants,
        instructionInfoContexts,
      ),
    );

    // PARAM_TOKEN_AMOUNT.TOKEN refs: try TOKEN_INFO first (optimistic mint).
    // If that fails, fall back to TOKEN_ACCOUNT_STATE (it's an ATA).
    const tokenAmountFallbackAccounts: string[] = [];
    for (const ref of requirements.tokenAmountRefs) {
      const tokenInfoContexts = await this.getContextsByType(
        {
          deviceModelId: this.args.deviceModelId,
          mints: [ref],
          network: this.network,
        },
        ClearSignContextType.SOLANA_TOKEN_INFO,
      );
      if (tokenInfoContexts.length > 0) {
        poolContexts.push(...tokenInfoContexts);
      } else {
        tokenAmountFallbackAccounts.push(ref);
      }
    }

    // RequirementAccumulator.build() already strips tokenAmountAltRefs and
    // mintAltRefs entries from altResolutions, and tokenAccountStates entries
    // from tokenAmountRefs (cross-bucket priority dedup), so
    // requirements.altResolutions is safe to use directly here. The fallback
    // merge below is still deduplicated defensively: streaming the same
    // TOKEN_ACCOUNT_STATE twice makes the device reject the second one.
    const challengeBoundRequirements: ChallengeBoundRequirements = {
      tokenAccountStates: [
        ...new Set([
          ...requirements.tokenAccountStates,
          ...tokenAmountFallbackAccounts,
        ]),
      ],
      altResolutions: requirements.altResolutions,
      trustedNames: requirements.trustedNames,
      tokenAmountAltRefs: requirements.tokenAmountAltRefs,
      mintAltRefs: requirements.mintAltRefs,
    };

    this.logger.debug("[run] built clear-sign context", {
      data: {
        mode,
        templates: instructionInfoContexts.length,
        pool: poolContexts.length,
        challengeBound:
          challengeBoundRequirements.tokenAccountStates.length +
          challengeBoundRequirements.altResolutions.length +
          challengeBoundRequirements.trustedNames.length +
          challengeBoundRequirements.tokenAmountAltRefs.length +
          challengeBoundRequirements.mintAltRefs.length,
      },
    });

    return {
      mode,
      poolContexts,
      instructionInfoContexts,
      challengeBoundRequirements,
      unrecognizedProgramIds: [],
    };
  }

  private logTransactionInstructions(
    message: NormalizedMessage,
    byProgram: Map<
      string,
      { payload: SolanaInstructionInfoPayload; context: ClearSignContext }[]
    >,
    matched: MatchedInstruction[],
    unrecognized: number,
  ): void {
    const total = message.compiledInstructions.length;
    const recognized = matched.length;
    const skipped = total - recognized - unrecognized;
    this.logger.debug("[run] transaction instructions", {
      data: {
        summary: {
          total,
          skipped,
          recognized,
          unrecognized,
          usesAlt:
            message.addressLookupRefs?.some((ref) => ref !== undefined) ??
            false,
        },
        instructions: message.compiledInstructions.map((ix) => {
          const programId = this.programIdOf(message, ix.programIdIndex);
          const accountCount = ix.accountKeyIndexes.length;
          const dataLength = ix.data.length;
          if (programId === COMPUTE_BUDGET_PROGRAM_ID) {
            return {
              programId,
              fn: `compute-budget:0x${ix.data[0]?.toString(16) ?? "??"}`,
              accountCount,
              dataLength,
            };
          }
          const candidate = (byProgram.get(programId) ?? [])
            .filter(({ payload }) =>
              this.discriminatorMatches(payload.discriminator, ix.data),
            )
            .sort(
              (a, b) =>
                b.payload.discriminator.length - a.payload.discriminator.length,
            )[0];
          if (candidate) {
            return {
              programId,
              fn:
                candidate.payload.instructionName ??
                candidate.payload.discriminator ??
                "(no discriminator)",
              accountCount,
              dataLength,
            };
          }
          return {
            programId,
            recognized: false,
            reason: byProgram.has(programId)
              ? "discriminator-not-matched"
              : "program-not-in-cal",
            accountCount,
            dataLength,
          };
        }),
      },
    });
  }

  /** Fetch contexts of `type`; ERROR / wrong-type contexts are dropped (satellites degrade). */
  private async getContextsByType<TInput>(
    input: TInput,
    type: ClearSignContextType,
  ): Promise<ClearSignContext[]> {
    const contexts = await this.args.contextModule.getContexts(input, [type]);
    const usable = contexts.filter((c) => c.type === type);
    if (usable.length === 0) {
      this.logger.warn(
        "[run] satellite fetch yielded no descriptor (degraded)",
        {
          data: { type },
        },
      );
    }
    return usable;
  }

  /** Build SOLANA_ENUM_VARIANT contexts for the selected variants from the bundled payloads. */
  private selectedEnumVariants(
    keys: readonly {
      programId: string;
      enumId: string;
      variantIndex: number;
    }[],
    instructionInfoContexts: ClearSignContext[],
  ): ClearSignContext[] {
    const out: ClearSignContext[] = [];
    for (const key of keys) {
      for (const context of instructionInfoContexts) {
        if (context.type !== ClearSignContextType.SOLANA_INSTRUCTION_INFO)
          continue;
        if (context.payload.programId !== key.programId) continue;
        const variant = context.payload.enumVariants.find(
          (v) => v.enumId === key.enumId && v.variantIndex === key.variantIndex,
        );
        if (variant) {
          out.push({
            type: ClearSignContextType.SOLANA_ENUM_VARIANT,
            payload: {
              programId: key.programId,
              enumId: key.enumId,
              variantIndex: key.variantIndex,
              descriptor: variant.descriptor,
            },
            certificate: context.certificate,
          });
          break;
        }
      }
    }
    return out;
  }

  private programIdOf(message: NormalizedMessage, index: number): string {
    return message.allKeys[index]?.toBase58() ?? "";
  }

  private discriminatorMatches(
    discriminatorHex: string,
    data: Uint8Array,
  ): boolean {
    // Single-instruction programs (e.g. SPL Memo) carry no discriminator: the
    // instruction data is all arguments, so the descriptor matches any data.
    if (discriminatorHex === "") return true;
    const disc = hexaStringToBuffer(discriminatorHex);
    if (!disc || disc.length === 0 || data.length < disc.length) return false;
    for (let i = 0; i < disc.length; i++) {
      if (data[i] !== disc[i]) return false;
    }
    return true;
  }

  private toInstructionDescriptor(
    payload: SolanaInstructionInfoPayload,
  ): InstructionDescriptor {
    return {
      discriminator: payload.discriminator,
      idlDescriptor: {
        type_pool: payload.idlDescriptor.typePool,
        root_type: payload.idlDescriptor.rootType,
      },
      mintAssociations: payload.mintAssociations,
      valueFlowPorts: payload.valueFlowPorts,
      accountResets: payload.accountResets,
      displayFields: payload.displayFields,
      enumCache: this.toEnumCache(payload.enumVariants),
    };
  }

  private toEnumCache(
    enumVariants: SolanaInstructionInfoPayload["enumVariants"],
  ): VariantCache {
    if (enumVariants.length === 0) return EMPTY_ENUM_CACHE;
    const tlvs: Uint8Array[] = [];
    for (const variant of enumVariants) {
      const bytes = hexaStringToBuffer(variant.descriptor.data);
      if (bytes) tlvs.push(bytes);
    }
    return buildEnumCache(tlvs).caseOf({
      Left: () => EMPTY_ENUM_CACHE,
      Right: (cache) => cache,
    });
  }

  private toRequirementAccounts(
    message: NormalizedMessage,
    accountKeyIndexes: number[],
    accountWritable: boolean[],
  ): RequirementAccount[] {
    return accountKeyIndexes.map((keyIdx, slot) => {
      const isWritable = accountWritable[slot] ?? false;
      const altRef = message.addressLookupRefs?.[keyIdx];
      if (altRef) {
        return {
          isWritable,
          altRef: {
            altAddress: altRef.altAddress.toBase58(),
            entryIndex: altRef.entryIndex,
          },
        };
      }
      return { isWritable, address: message.allKeys[keyIdx]?.toBase58() };
    });
  }
}
