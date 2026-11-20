import { array, Codec, type Either, string } from "purify-ts";

export type GetMptDescriptorParams = {
  issuanceId: string;
};

export const mptDataResponsesCodec = array(
  Codec.interface({
    descriptor: Codec.interface({
      data: string,
      signatures: Codec.interface({
        prod: string,
        test: string,
      }),
    }),
  }),
);

export interface MptDataSource {
  getMptDescriptor(
    params: GetMptDescriptorParams,
  ): Promise<Either<Error, string>>;
}
