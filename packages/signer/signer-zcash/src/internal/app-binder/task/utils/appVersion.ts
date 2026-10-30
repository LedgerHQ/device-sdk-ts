/** First Zcash app version that accepts the user address receivers. */
export const MIN_APP_VERSION_FOR_USER_ADDRESS = "3.11.0";

const parseVersion = (version: string): [number, number, number] | null => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (match === null) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

/**
 * Numeric `major.minor.patch` comparison (so `3.11.0` is above `3.9.5`).
 * Returns `false` when either string is not a plain `major.minor.patch`.
 */
export const isAppVersionAtLeast = (
  version: string,
  floor: string,
): boolean => {
  const actual = parseVersion(version);
  const minimum = parseVersion(floor);
  if (actual === null || minimum === null) {
    return false;
  }
  for (let i = 0; i < 3; i += 1) {
    if (actual[i]! !== minimum[i]!) {
      return actual[i]! > minimum[i]!;
    }
  }
  return true;
};
