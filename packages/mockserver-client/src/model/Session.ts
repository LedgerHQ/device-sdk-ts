import { array, Codec, number, string } from "purify-ts";

import { type Device, deviceCodec } from "./Device";

/**
 * A mock server session, resolved from a bearer token.
 *
 * All devices and mocks are scoped to the session that owns the token.
 */
export interface Session {
  readonly id: string;
  readonly created_at: number;
  readonly expires_at: number;
  readonly devices: Device[];
}

export const sessionCodec = Codec.interface({
  id: string,
  created_at: number,
  expires_at: number,
  devices: array(deviceCodec),
});
