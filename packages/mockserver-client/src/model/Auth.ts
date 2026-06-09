import { boolean, Codec, number, string } from "purify-ts";

import { type Device, deviceCodec } from "./Device";

/**
 * Response of POST /auth: an opaque bearer token identifying a session and its
 * expiry timestamp (epoch ms). See ADR 002 (Solution 3) and ADR 003.
 */
export interface AuthResponse {
  readonly token: string;
  readonly expires_at: number;
}

export const authResponseCodec = Codec.interface({
  token: string,
  expires_at: number,
});

/**
 * State returned when connecting a device (POST /devices/:id/connect).
 */
export interface ConnectionState {
  readonly device: Device;
  readonly connected: boolean;
}

export const connectionStateCodec = Codec.interface({
  device: deviceCodec,
  connected: boolean,
});
