import { array, Codec, optional, string } from "purify-ts";

/**
 * A canned APDU response registered against a device.
 *
 * Whenever an incoming APDU starts with {@link Mock.prefix} (hex), the mock
 * server returns the next entry of {@link Mock.responses}, advancing one entry
 * per matching APDU and looping back to the start once the list is exhausted.
 * Mocks are device-scoped: each device owns its own independent mock table.
 */
export interface Mock {
  readonly id: string;
  readonly prefix: string;
  readonly responses: string[];
}

export const mockCodec = Codec.interface({
  id: string,
  prefix: string,
  responses: array(string),
});

/**
 * Payload used to create (POST /mocks) or edit (PATCH /mocks/:id) a mock.
 *
 * Provide either an ordered {@link MockConfig.responses} list or a single
 * {@link MockConfig.response} (shorthand for `responses: [response]`).
 */
export interface MockConfig {
  readonly prefix: string;
  readonly response?: string;
  readonly responses?: string[];
}

export const mockConfigCodec = Codec.interface({
  prefix: string,
  response: optional(string),
  responses: optional(array(string)),
});
