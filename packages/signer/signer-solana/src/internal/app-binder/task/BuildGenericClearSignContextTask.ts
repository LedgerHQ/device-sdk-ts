import {
  type ClearSignContext,
  ClearSignContextType,
  type ContextModule,
  type SolanaInstructionInfoPayload,
  type SolanaInstructionSubstructure,
} from "@ledgerhq/context-module";
import {
  type DeviceModelId,
  hexaStringToBuffer,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type ClearSignMode } from "@api/app-binder/SignTransactionDeviceActionTypes";
import {
  buildEnumCache,
  type VariantCache,
} from "@internal/app-binder/clear-sign/idl-type-pool";
import {
  buildRequirements,
  type BuildRequirementsOptions,
  type InstructionDescriptor,
  type MatchedInstruction,
  type RequirementAccount,
  type SubstructureDescriptor,
  SubstructureKind,
} from "@internal/app-binder/clear-sign/requirements";
import { GetChallengeCommand } from "@internal/app-binder/command/GetChallengeCommand";
import { type NormalizedMessage } from "@internal/app-binder/services/TransactionInspector";
import { TransactionParser } from "@internal/app-binder/services/utils/TransactionParser";

/**
 * ComputeBudget program — a hardcoded allow-list skip. It has no CAL descriptor
 * and is understood natively by the device: never looked up, never counted,
 * never streamed. `setComputeUnitPrice` (priority fee) is a ComputeBudget
 * instruction so it is covered by the same skip.
 */
export const COMPUTE_BUDGET_PROGRAM_ID =
  "ComputeBudget111111111111111111111111111111";

const DEFAULT_NETWORK = "solana-mainnet";
const EMPTY_ENUM_CACHE: VariantCache = new Map();

const SUBSTRUCTURE_KIND_BY_VALUE: Record<number, SubstructureKind> = {
  [SubstructureKind.DISPLAY_FIELD]: SubstructureKind.DISPLAY_FIELD,
  [SubstructureKind.VALUE_FLOW_PORT]: SubstructureKind.VALUE_FLOW_PORT,
  [SubstructureKind.HIDE_RULE]: SubstructureKind.HIDE_RULE,
  [SubstructureKind.ACCOUNT_RESET]: SubstructureKind.ACCOUNT_RESET,
};

/**
 * Everything the device needs to clear-sign a transaction, gathered host-side.
 * A `provide` step just streams these.
 */
export type GenericClearSignContext = {
  /** `full` (merge) / `srfc39-only` (partial) / `none` (legacy fallback). */
  readonly mode: ClearSignMode;
  /** Phase A pool descriptors (token-info, enum-variant, trusted-name, token-account-state, alt-resolution). */
  readonly poolContexts: ClearSignContext[];
  /** Phase B templates: one SOLANA_INSTRUCTION_INFO per matched (programId, discriminator). */
  readonly instructionInfoContexts: ClearSignContext[];
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
 * requirement set, and fetch every satellite descriptor (challenge-bound ones
 * bound to a single device challenge). The matching `provide` task only streams
 * the result.
 */
export class BuildGenericClearSignContextTask {
  private readonly logger: LoggerPublisherService;
  private readonly network: string;

  constructor(
    private readonly api: InternalApi,
    private readonly args: BuildGenericClearSignContextTaskArgs,
  ) {
    this.logger = args.loggerFactory("BuildGenericClearSignContextTask");
    this.network = args.network ?? DEFAULT_NETWORK;
  }

  async run(): Promise<GenericClearSignContext> {
    const none: GenericClearSignContext = {
      mode: "none",
      poolContexts: [],
      instructionInfoContexts: [],
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
    if (remaining.length === 0) return none;

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
    let unrecognized = 0;
    for (const { ix, programId } of remaining) {
      const candidate = (byProgram.get(programId) ?? []).find(({ payload }) =>
        this.discriminatorMatches(payload.discriminator, ix.data),
      );
      const descriptor = candidate
        ? this.toInstructionDescriptor(candidate.payload)
        : null;
      if (!candidate || !descriptor) {
        unrecognized += 1;
        continue;
      }
      matched.push({
        instruction: {
          programId,
          accounts: this.toRequirementAccounts(message, ix.accountKeyIndexes),
          data: ix.data,
        },
        descriptor,
      });
      templateByKey.set(
        `${programId}:${candidate.payload.discriminator}`,
        candidate.context,
      );
    }
    if (matched.length === 0) return none;

    const mode: ClearSignMode = unrecognized === 0 ? "full" : "srfc39-only";
    const instructionInfoContexts = Array.from(templateByKey.values());

    // --- Requirements (Stage 2) ---
    const requirementsResult = buildRequirements(matched, {
      selectEnumVariants: this.args.selectEnumVariants,
    });
    if (requirementsResult.isLeft()) {
      this.logger.warn("[run] requirement build failed; falling back", {
        data: { error: requirementsResult.extract() },
      });
      return none;
    }
    const requirements = requirementsResult.unsafeCoerce();

    // --- Fetch satellites (Stage 3) ---
    const poolContexts: ClearSignContext[] = [];
    if (requirements.tokenInfos.length > 0) {
      poolContexts.push(
        ...(await this.fetch(
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

    const challenge = await this.getChallenge();
    if (challenge !== undefined) {
      for (const account of requirements.tokenAccountStates) {
        poolContexts.push(
          ...(await this.fetch(
            {
              deviceModelId: this.args.deviceModelId,
              requests: [{ tokenAccount: account, challenge }],
            },
            ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
          )),
        );
      }
      for (const alt of requirements.altResolutions) {
        poolContexts.push(
          ...(await this.fetch(
            {
              deviceModelId: this.args.deviceModelId,
              requests: [
                {
                  altAddress: alt.altAddress,
                  entryIndex: alt.entryIndex,
                  challenge,
                },
              ],
            },
            ClearSignContextType.SOLANA_ALT_RESOLUTION,
          )),
        );
      }
      for (const address of requirements.trustedNames) {
        poolContexts.push(
          ...(await this.fetch(
            {
              deviceModelId: this.args.deviceModelId,
              network: this.network,
              // types/sources are not carried by the requirement set; left
              // empty pending backend confirmation.
              requests: [{ address, challenge, types: [], sources: [] }],
            },
            ClearSignContextType.SOLANA_TRUSTED_NAME,
          )),
        );
      }
    }

    this.logger.debug("[run] built clear-sign context", {
      data: {
        mode,
        templates: instructionInfoContexts.length,
        pool: poolContexts.length,
      },
    });

    return { mode, poolContexts, instructionInfoContexts };
  }

  /** Fetch contexts of `type`; ERROR / wrong-type contexts are dropped (satellites degrade). */
  private async fetch<TInput>(
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

  private async getChallenge(): Promise<string | undefined> {
    const result = await this.api.sendCommand(new GetChallengeCommand());
    if (!isSuccessCommandResult(result)) {
      this.logger.warn(
        "[run] GET CHALLENGE failed; skipping challenge-bound descriptors",
      );
      return undefined;
    }
    return result.data.challenge;
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
    const disc = hexaStringToBuffer(discriminatorHex);
    if (!disc || disc.length === 0 || data.length < disc.length) return false;
    for (let i = 0; i < disc.length; i++) {
      if (data[i] !== disc[i]) return false;
    }
    return true;
  }

  private toInstructionDescriptor(
    payload: SolanaInstructionInfoPayload,
  ): InstructionDescriptor | null {
    const instructionInfo = hexaStringToBuffer(payload.instructionInfo.data);
    if (!instructionInfo) return null;
    const substructures: SubstructureDescriptor[] = [];
    for (const sub of payload.substructures) {
      const mapped = this.toSubstructure(sub);
      if (mapped) substructures.push(mapped);
    }
    return {
      discriminator: payload.discriminator,
      instructionInfo,
      substructures,
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

  private toSubstructure(
    sub: SolanaInstructionSubstructure,
  ): SubstructureDescriptor | null {
    const kind = SUBSTRUCTURE_KIND_BY_VALUE[sub.kind];
    const data = hexaStringToBuffer(sub.data);
    if (kind === undefined || !data) return null;
    return { kind, data };
  }

  private toRequirementAccounts(
    message: NormalizedMessage,
    accountKeyIndexes: number[],
  ): RequirementAccount[] {
    return accountKeyIndexes.map((keyIdx) => {
      const altRef = message.addressLookupRefs?.[keyIdx];
      if (altRef) {
        return {
          altRef: {
            altAddress: altRef.altAddress.toBase58(),
            entryIndex: altRef.entryIndex,
          },
        };
      }
      return { address: message.allKeys[keyIdx]?.toBase58() };
    });
  }
}
