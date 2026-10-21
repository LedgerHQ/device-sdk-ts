import {
  hexaStringToBuffer,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import {
  array,
  Codec,
  type Either,
  Left,
  optional,
  Right,
  string,
} from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import {
  type InstructionInfoDataSource,
  type InstructionInfoResult,
  SolanaProgramNotFoundError,
} from "@/modules/solana/instruction-info/data/InstructionInfoDataSource";
import { instructionInfoTypes } from "@/modules/solana/instruction-info/di/instructionInfoTypes";
import {
  type SolanaBasicFlowRule,
  type SolanaInstructionMatcher,
} from "@/modules/solana/model/SolanaContextTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

const NETWORK_DEFAULT = "solana-mainnet";

const SUPPORTED_TYPES: ClearSignContextType[] = [
  ClearSignContextType.SOLANA_BASIC_FLOW_RULE,
];

export type SolanaBasicFlowRuleContextInput = {
  programIds: string[];
  network?: string;
};

const solanaBasicFlowRuleInputCodec = Codec.interface({
  programIds: array(string),
  network: optional(string),
});

type MatcherRole = "required" | "allowed";

// Discriminators per program, in first-seen order, for one rule and role.
type RuleBuilder = Record<MatcherRole, Map<string, Uint8Array[]>>;

/**
 * Rebuilds the basic-flow rules CAL tags on the given programs.
 *
 * CAL doesn't serve rules: it tags instructions with `{ rule, role }` in the
 * `solana_programs` response. Tags are grouped by rule id across programs,
 * giving one matcher per (program, role) with the tagged instructions'
 * discriminators. CAL rules always carry discriminators: CAL can't express
 * "any instruction of this program".
 *
 * Emits one SOLANA_BASIC_FLOW_RULE context per rule, or a single ERROR
 * context when any CAL lookup fails. A program CAL doesn't know just
 * contributes no tags.
 */
@injectable()
export class SolanaBasicFlowRuleContextLoader
  implements ContextLoader<SolanaBasicFlowRuleContextInput>
{
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(instructionInfoTypes.InstructionInfoDataSource)
    private readonly dataSource: InstructionInfoDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("SolanaBasicFlowRuleContextLoader");
  }

  public canHandle(
    input: unknown,
    expectedTypes: ClearSignContextType[],
  ): input is SolanaBasicFlowRuleContextInput {
    if (!SUPPORTED_TYPES.every((t) => expectedTypes.includes(t))) return false;
    return solanaBasicFlowRuleInputCodec.decode(input).isRight();
  }

  public async load(
    input: SolanaBasicFlowRuleContextInput,
  ): Promise<ClearSignContext[]> {
    const rules = await this.loadRules(input);
    return rules.caseOf<ClearSignContext[]>({
      Left: (error) => [{ type: ClearSignContextType.ERROR, error }],
      Right: (loaded) =>
        loaded.map((rule) => ({
          type: ClearSignContextType.SOLANA_BASIC_FLOW_RULE,
          payload: rule,
        })),
    });
  }

  private async loadRules({
    programIds,
    network,
  }: SolanaBasicFlowRuleContextInput): Promise<
    Either<Error, SolanaBasicFlowRule[]>
  > {
    const resolvedNetwork = network || NETWORK_DEFAULT;
    const distinctProgramIds = Array.from(new Set(programIds));

    const results = await Promise.all(
      distinctProgramIds.map(async (programId) => ({
        programId,
        either: await this.dataSource.getInstructionInfo({
          programId,
          network: resolvedNetwork,
        }),
      })),
    );

    const programs: InstructionInfoResult[] = [];
    const failures: Error[] = [];
    for (const { programId, either } of results) {
      either.caseOf<void>({
        Left: (error) => {
          if (error instanceof SolanaProgramNotFoundError) {
            this.logger.debug("[load] Program not in CAL, no signing route", {
              data: { programId },
            });
            return;
          }
          this.logger.warn("[load] Failed to fetch signing routes from CAL", {
            data: { programId, error: error.message },
          });
          failures.push(error);
        },
        Right: (program) => {
          programs.push(program);
        },
      });
    }
    const [failure] = failures;
    if (failure !== undefined) {
      return Left(failure);
    }

    const rules = this.buildRules(programs);
    this.logger.debug("[load] Built basic-flow rules", {
      data: { rules: rules.map(({ id }) => id) },
    });
    return Right(rules);
  }

  private buildRules(programs: InstructionInfoResult[]): SolanaBasicFlowRule[] {
    const builders = new Map<string, RuleBuilder>();

    for (const { programId, basicFlowTags } of programs) {
      for (const { discriminator, rule, role } of basicFlowTags) {
        const bytes = hexaStringToBuffer(discriminator);
        if (bytes === null || bytes.length === 0) {
          this.logger.warn("[load] Skipping tag with invalid discriminator", {
            data: { programId, discriminator, rule },
          });
          continue;
        }

        let builder = builders.get(rule);
        if (builder === undefined) {
          builder = { required: new Map(), allowed: new Map() };
          builders.set(rule, builder);
        }
        const discriminators = builder[role].get(programId) ?? [];
        discriminators.push(bytes);
        builder[role].set(programId, discriminators);
      }
    }

    return Array.from(builders, ([id, builder]) => ({
      id,
      required: toMatchers(builder.required),
      allowed: toMatchers(builder.allowed),
    }));
  }
}

function toMatchers(
  byProgram: Map<string, Uint8Array[]>,
): SolanaInstructionMatcher[] {
  return Array.from(byProgram, ([programId, discriminators]) => ({
    programId,
    discriminators,
  }));
}
