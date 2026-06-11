import { Codec, type GetType, Left, Right, string } from "purify-ts";

/**
 * Codec for a non-empty string. Rejects `""` so callers can't decode a
 * malformed-but-typed-correctly response (e.g. `signedDescriptor: ""`)
 * into a valid DTO.
 */
const nonEmptyString = Codec.custom<string>({
  decode: (input) =>
    typeof input === "string" && input.length > 0
      ? Right(input)
      : Left("Expected a non-empty string"),
  encode: (value) => value,
});

/**
 * Common envelope shape returned by the Solana dynamic-descriptor backend
 * endpoints: a hex-encoded signed TLV plus the PKI key identifiers used to
 * load the matching certificate. `Codec.interface` ignores extra fields, so
 * each datasource can validate this shared slice and ignore the rest of its
 * own response.
 */
export const signedDescriptorDtoCodec = Codec.interface({
  signedDescriptor: nonEmptyString,
  keyId: string,
  keyUsage: string,
});

export type SignedDescriptorDto = GetType<typeof signedDescriptorDtoCodec>;
