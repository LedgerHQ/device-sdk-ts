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
 * - `basicFlowTags` lists the instructions' `signing_route.basic_flow`
 *   tags, one entry per (discriminator, rule, role).
 */
export type InstructionInfoResult = {
  programId: string;
  descriptors: Record<string, Either<Error, SolanaInstructionInfoPayload>>;
  enumVariants: SolanaInstructionEnumVariant[];
  basicFlowTags: SolanaBasicFlowTag[];
};

/**
 * Tags one instruction (by discriminator hex) as part of a basic-flow rule.
 * Only instructions with a discriminator carry tags.
 */
export type SolanaBasicFlowTag = {
  discriminator: string;
  rule: string;
  role: "required" | "allowed";
};

/**
 * Returned when CAL answers but has no entry for the program, as opposed to a
 * transport, HTTP or validation failure.
 */
export class SolanaProgramNotFoundError extends Error {
  readonly programId: string;

  constructor(programId: string, message: string) {
    super(message);
    this.name = "SolanaProgramNotFoundError";
    this.programId = programId;
  }
}

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
