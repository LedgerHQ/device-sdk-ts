import { type Mock } from "@ledgerhq/device-mockserver-client";

/**
 * Select the mock that should answer an incoming APDU, or `undefined` when
 * none matches.
 *
 * Mocks match when the (normalised, lower-case) APDU hex starts with their
 * `prefix`. When several mocks match, the one with the longest prefix wins so
 * more specific mocks take precedence; among equally specific matches the most
 * recently added one wins, so re-seeding a prefix overrides earlier (e.g.
 * default) mocks. Resolving the matched mock to a concrete response (including
 * advancing its response sequence) is the caller's responsibility.
 */
export function matchApdu(apduHex: string, mocks: Mock[]): Mock | undefined {
  const apdu = apduHex.toLowerCase();
  const matches = mocks.filter((mock) =>
    apdu.startsWith(mock.prefix.toLowerCase()),
  );
  if (matches.length === 0) {
    return undefined;
  }
  const maxPrefixLength = Math.max(
    ...matches.map((mock) => mock.prefix.length),
  );
  const mostSpecific = matches.filter(
    (mock) => mock.prefix.length === maxPrefixLength,
  );
  return mostSpecific[mostSpecific.length - 1];
}
