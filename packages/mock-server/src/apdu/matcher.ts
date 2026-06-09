import { type Mock } from "@ledgerhq/device-mockserver-client";

import { UNKNOWN_APDU_RESPONSE } from "../defaults";

/**
 * Resolve the canned response for an incoming APDU.
 *
 * Mocks match when the (normalised, lower-case) APDU hex starts with their
 * `prefix`. When several mocks match, the one with the longest prefix wins so
 * more specific mocks take precedence; among equally specific matches the most
 * recently added one wins, so re-seeding a prefix overrides earlier (e.g.
 * default) mocks. Falls back to a "not supported" status word when nothing
 * matches.
 */
export function matchApdu(apduHex: string, mocks: Mock[]): string {
  const apdu = apduHex.toLowerCase();
  const matches = mocks.filter((mock) =>
    apdu.startsWith(mock.prefix.toLowerCase()),
  );
  if (matches.length === 0) {
    return UNKNOWN_APDU_RESPONSE;
  }
  const maxPrefixLength = Math.max(
    ...matches.map((mock) => mock.prefix.length),
  );
  const mostSpecific = matches.filter(
    (mock) => mock.prefix.length === maxPrefixLength,
  );
  const winner = mostSpecific[mostSpecific.length - 1];
  return winner ? winner.response : UNKNOWN_APDU_RESPONSE;
}
