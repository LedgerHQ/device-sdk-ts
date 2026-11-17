import { array, Codec, type Either, optional, string } from "purify-ts";

export type GetMptDescriptorParams = {
  issuanceId: string;
};

/**
 * Both signatures are optional: CAL serves a descriptor signed in test mode
 * only until the production signature exists.
 */
export const mptDataResponsesCodec = array(
  Codec.interface({
    descriptor: Codec.interface({
      data: string,
      signatures: Codec.interface({
        prod: optional(string),
        test: optional(string),
      }),
    }),
  }),
);

export interface MptDataSource {
  getMptDescriptor(
    params: GetMptDescriptorParams,
  ): Promise<Either<Error, string>>;
}
