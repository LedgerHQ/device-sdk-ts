import {
  hexaStringToBuffer,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

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

const NETWORK_DEFAULT = "solana-mainnet";

export type GetSolanaBasicFlowRulesParams = {
  programIds: string[];
  network?: string;
};

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
 * Returns `Left` when any CAL lookup fails. A program CAL doesn't know just
 * contributes no tags.
 */
@injectable()
export class SolanaBasicFlowRulesLoader {
  private readonly logger: LoggerPublisherService;

  constructor(
    @inject(instructionInfoTypes.InstructionInfoDataSource)
    private readonly dataSource: InstructionInfoDataSource,
    @inject(configTypes.ContextModuleLoggerFactory)
    loggerFactory: (tag: string) => LoggerPublisherService,
  ) {
    this.logger = loggerFactory("SolanaBasicFlowRulesLoader");
  }

  public async load({
    programIds,
    network,
  }: GetSolanaBasicFlowRulesParams): Promise<
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
