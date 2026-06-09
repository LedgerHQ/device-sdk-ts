import { array, Codec, string } from "purify-ts";

/**
 * A canned APDU response registered against a session.
 *
 * Whenever an incoming APDU starts with {@link Mock.prefix} (hex), the mock
 * server returns the next entry of {@link Mock.responses}, advancing one entry
 * per matching APDU and looping back to the start once the list is exhausted.
 * Mocks are session-scoped.
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
