import { array, Codec, type Either, string } from "purify-ts";

export type GetTokenInfosParams = {
  assetId: string;
};

/**
 * Only the fields the payload is read from are validated: a CAL change to the
 * ones we ignore must not downgrade a signable descriptor to a blind signature.
 */
export const tokenDataResponsesCodec = array(
  Codec.interface({
    descriptor: Codec.interface({
      signatures: Codec.interface({
        prod: string,
        test: string,
      }),
    }),
  }),
);

export interface TokenDataSource {
  getTokenInfosPayload(
    params: GetTokenInfosParams,
  ): Promise<Either<Error, string>>;
}
