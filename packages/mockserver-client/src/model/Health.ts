import { Codec, number, string } from "purify-ts";

/** Response of GET /health. */
export interface Health {
  readonly status: string;
  readonly sessions: number;
}

export const healthCodec = Codec.interface({
  status: string,
  sessions: number,
});
