import { type Either } from "purify-ts";

export type GetSolanaGatedDescriptorsParams = {
  /** Base58 program ID. */
  programId: string;
};

/** One gated descriptor of a program, as served by CAL. */
export type SolanaGatedDescriptor = {
  /** Base58 ID of the program the descriptor targets. */
  programId: string;
  /**
   * Bytes the instruction data must start with. Empty when the descriptor
   * targets the whole program ("program only").
   */
  discriminator: Uint8Array;
  /** Descriptor TLV with the CAL signature appended, hex encoded. */
  signedDescriptor: string;
};

export interface SolanaGatedDescriptorDataSource {
  /**
   * Every gated descriptor CAL has for the program. An empty list means the
   * program is not gated.
   */
  getGatedDescriptors(
    params: GetSolanaGatedDescriptorsParams,
  ): Promise<Either<Error, SolanaGatedDescriptor[]>>;
}
