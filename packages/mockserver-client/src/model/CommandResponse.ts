import { Codec, string } from "purify-ts";

/**
 * The result of simulating an APDU exchange (POST /devices/:id/apdu).
 *
 * {@link CommandResponse.response} is the full response hex, data followed by the
 * two-byte status word.
 */
export interface CommandResponse {
  readonly response: string;
}

export const commandResponseCodec = Codec.interface({
  response: string,
});
