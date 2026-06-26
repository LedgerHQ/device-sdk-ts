import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import {
  Codec,
  Either,
  Left,
  record,
  Right,
  string,
  unknown as unknownCodec,
} from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  GetInstructionInfoParams,
  InstructionInfoDataSource,
  InstructionInfoResult,
} from "./InstructionInfoDataSource";
import {
  type CalInstructionDescriptorDto,
  calInstructionDescriptorsCodec,
} from "./InstructionInfoDto";
import {
  type CalMode,
  toInstructionInfoPayload,
  toProgramEnumVariants,
} from "./InstructionInfoMapper";

// Validates the outer envelope shape only. Per-discriminator descriptor
// content is validated downstream by the loader before being consumed.
const calInstructionInfoEnvelopeCodec = Codec.interface({
  descriptors_instruction: record(string, unknownCodec),
});

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
    let data: unknown;
    try {
      data = await this.http.get(`${this.config.cal.url}/solana`, {
        params: {
          output: "descriptors_instruction",
          network,
          program: programId,
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

    return calInstructionInfoEnvelopeCodec
      .decode(data[0])
      .caseOf<Either<Error, InstructionInfoResult>>({
        Left: (error) =>
          Left(
            new Error(
              `[ContextModule] HttpInstructionInfoDataSource: malformed response for program ${programId}: ${error}`,
            ),
          ),
        Right: (envelope) => {
          const descriptors = envelope.descriptors_instruction[programId];
          if (descriptors == null || typeof descriptors !== "object") {
            return Left(
              new Error(
                `[ContextModule] HttpInstructionInfoDataSource: no descriptors for program ${programId}`,
              ),
            );
          }

          // Validate the inner descriptor shape so the mapper can dereference
          // `instruction_info.descriptor` / `enum_variants` without
          // runtime-throwing on a malformed CAL payload. A malformed descriptor
          // degrades the whole program to a per-program ERROR rather than
          // rejecting the batch. On success we transform each validated DTO into
          // the core payload so the loader never sees the CAL DTO shapes.
          return calInstructionDescriptorsCodec
            .decode(descriptors)
            .caseOf<Either<Error, InstructionInfoResult>>({
              Left: (error) =>
                Left(
                  new Error(
                    `[ContextModule] HttpInstructionInfoDataSource: malformed descriptors for program ${programId}: ${error}`,
                  ),
                ),
              // The codec only validates the consumed shape and strips
              // undeclared fields, so we transform the original (full) object —
              // the cast is justified now that the shape has been validated.
              Right: () => {
                const mode: CalMode = this.config.cal.mode ?? "prod";
                const validatedDescriptors = descriptors as Record<
                  string,
                  CalInstructionDescriptorDto
                >;
                const mapped = Object.fromEntries(
                  Object.entries(validatedDescriptors).map(
                    ([discriminator, dto]) => [
                      discriminator,
                      toInstructionInfoPayload(discriminator, dto, mode),
                    ],
                  ),
                );
                return Right({
                  programId,
                  descriptors: mapped,
                  enumVariants: toProgramEnumVariants(
                    validatedDescriptors,
                    mode,
                  ),
                });
              },
            });
        },
      });
  }
}
