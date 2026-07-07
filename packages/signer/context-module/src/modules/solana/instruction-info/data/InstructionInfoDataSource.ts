import { type Either } from "purify-ts";

import {
  type SolanaInstructionEnumVariant,
  type SolanaInstructionInfoPayload,
} from "@/modules/solana/model/SolanaPayloads";

export type GetInstructionInfoParams = {
  programId: string;
  network: string;
};

/**
 * Result of one CAL call for a single `programId`, fully transformed into core
 * models so consumers never see the CAL DTO shapes.
 *
 * - `descriptors` is indexed by discriminator hex (multiple entries when a
 *   program defines several instructions). Each is the decoded
 *   {@link SolanaInstructionInfoPayload}, or a `Left` when that descriptor could
 *   not be decoded (e.g. no signature for the configured CAL mode) so the
 *   consumer can surface a per-descriptor error.
 * - `enumVariants` is the program-wide flat list of decoded enum variants,
 *   resolved independently of per-descriptor signature validity.
 */
export type InstructionInfoResult = {
  programId: string;
  descriptors: Record<string, Either<Error, SolanaInstructionInfoPayload>>;
  enumVariants: SolanaInstructionEnumVariant[];
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
