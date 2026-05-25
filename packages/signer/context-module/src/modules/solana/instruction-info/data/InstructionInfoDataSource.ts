import { type Either } from "purify-ts";

import { type CalInstructionDescriptorDto } from "./InstructionInfoDto";

export type GetInstructionInfoParams = {
  programId: string;
  network: string;
};

/**
 * Result of one CAL call for a single `programId`. Indexed by discriminator
 * hex; multiple entries when a program defines several instructions.
 */
export type InstructionInfoResult = {
  programId: string;
  descriptors: Record<string, CalInstructionDescriptorDto>;
};

export interface InstructionInfoDataSource {
  /**
   * Fetch all instruction descriptors for one Solana program from CAL.
   * One HTTP call per `programId`; consumers fan out across multiple
   * `programId`s in parallel.
   */
  getInstructionInfo(
    params: GetInstructionInfoParams,
  ): Promise<Either<Error, InstructionInfoResult>>;
}
