import { Codec, string } from "purify-ts";

/**
 * A canned APDU response registered against a session.
 *
 * The mock server returns {@link Mock.response} whenever an incoming APDU starts
 * with {@link Mock.prefix} (hex). Mocks are session-scoped (ADR 002, Solution 3).
 */
export interface Mock {
  readonly id: string;
  readonly prefix: string;
  readonly response: string;
}

export const mockCodec = Codec.interface({
  id: string,
  prefix: string,
  response: string,
});

/**
 * Payload used to create (POST /mocks) or edit (PATCH /mocks/:id) a mock.
 */
export interface MockConfig {
  readonly prefix: string;
  readonly response: string;
}
