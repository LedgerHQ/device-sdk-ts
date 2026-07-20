import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { SolanaTransactionScanChainId } from "@/modules/solana/model/SolanaTransactionScanChainId";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  GetInstructionInfoParams,
  InstructionInfoDataSource,
  InstructionInfoResult,
} from "./InstructionInfoDataSource";
import {
  type CalInstructionDescriptorDto,
  calInstructionProgramCodec,
  type CalInstructionProgramDto,
} from "./InstructionInfoDto";
import {
  type CalMode,
  toInstructionInfoPayload,
  toProgramEnumVariants,
} from "./InstructionInfoMapper";

// Maps the DMK network label to the numeric CAL `chain_id` (the extended
// Solana network ids 900/901/902). Unknown labels fall back to mainnet.
const CHAIN_ID_BY_NETWORK: Record<string, SolanaTransactionScanChainId> = {
  "solana-mainnet": SolanaTransactionScanChainId.MAINNET,
  "solana-devnet": SolanaTransactionScanChainId.DEVNET,
  "solana-testnet": SolanaTransactionScanChainId.TESTNET,
};

@injectable()
export class HttpInstructionInfoDataSource
  implements InstructionInfoDataSource
{
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getInstructionInfo({
    programId,
    network,
  }: GetInstructionInfoParams): Promise<Either<Error, InstructionInfoResult>> {
    const chainId =
      CHAIN_ID_BY_NETWORK[network] ?? SolanaTransactionScanChainId.MAINNET;
    let data: unknown;
    try {
      data = await this.http.get(`${this.config.cal.url}/solana_programs`, {
        params: {
          id: programId,
          chain_id: chainId,
          output: "id,chain_id,instructions",
          ref: `branch:${this.config.cal.branch}`,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Left(
        new Error(
          `[ContextModule] HttpInstructionInfoDataSource: Failed to fetch instruction descriptors: ${reason}`,
        ),
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      return Left(
        new Error(
          `[ContextModule] HttpInstructionInfoDataSource: empty response for program ${programId}`,
        ),
      );
    }

    // Select the program object whose `id` matches the requested `programId`
    // (the response is an array, one object per requested id).
    const program = data.find(
      (entry): entry is { id: unknown } =>
        entry != null &&
        typeof entry === "object" &&
        (entry as { id?: unknown }).id === programId,
    );
    if (program === undefined) {
      return Left(
        new Error(
          `[ContextModule] HttpInstructionInfoDataSource: no descriptors for program ${programId}`,
        ),
      );
    }

    // Validate the program shape so the mapper can dereference `descriptor` /
    // `enum_variants` without runtime-throwing on a malformed CAL payload. A
    // malformed program degrades to a per-program ERROR rather than rejecting
    // the batch. On success we transform each validated DTO into the core
    // payload so the loader never sees the CAL DTO shapes.
    return calInstructionProgramCodec
      .decode(program)
      .caseOf<Either<Error, InstructionInfoResult>>({
        Left: (error) =>
          Left(
            new Error(
              `[ContextModule] HttpInstructionInfoDataSource: malformed descriptors for program ${programId}: ${error}`,
            ),
          ),
        Right: () => {
          const mode: CalMode = this.config.cal.mode ?? "prod";
          // The codec strips undeclared fields, so we key the original
          // (full) instruction objects by `discriminator_hex` — the cast is
          // justified now that the shape has been validated.
          const instructions = (program as CalInstructionProgramDto)
            .instructions;
          const descriptorsByDiscriminator: Record<
            string,
            CalInstructionDescriptorDto
          > = Object.fromEntries(
            instructions.map((dto) => [dto.discriminator_hex, dto]),
          );
          const mapped = Object.fromEntries(
            Object.entries(descriptorsByDiscriminator).map(
              ([discriminator, dto]) => [
                discriminator,
                toInstructionInfoPayload(programId, discriminator, dto, mode),
              ],
            ),
          );
          return Right({
            programId,
            descriptors: mapped,
            enumVariants: toProgramEnumVariants(
              descriptorsByDiscriminator,
              mode,
            ),
          });
        },
      });
  }
}
