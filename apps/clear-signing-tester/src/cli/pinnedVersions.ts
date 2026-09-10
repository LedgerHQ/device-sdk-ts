import versions from "@root/versions.json";

/** `versions.json` shape: device > OS version > coin app > app version. */
type VersionTree = Record<string, Record<string, Record<string, string>>>;

export type PinnedVersions = {
  readonly osVersion: string;
  readonly appVersion: string;
};

/**
 * The OS and app version a run asks Speculinho for when it pins neither itself.
 *
 * Speculinho rejects an acquire that omits either version and resolves no
 * "latest", so every run needs a concrete pair. Reading them from
 * `versions.json` keeps CI and a local run on the same pair.
 *
 * The OS is not passed in: it follows from the app, since an app is pinned under
 * exactly one OS per device. That is why a flex Ethereum run lands on the
 * pre-release pair the Address Book needs, whether or not it touches contacts.
 *
 * @param coinApp - Coin app being exercised, as named in coin-apps
 * @param device - Device the run targets
 * @throws If the pair is missing, or ambiguous because the app is pinned twice
 */
export function pinnedVersions(
  coinApp: string,
  device: string,
): PinnedVersions {
  const byOsVersion = (versions as unknown as VersionTree)[device];
  if (!byOsVersion) {
    throw new Error(
      `No versions pinned for device "${device}" in versions.json.`,
    );
  }

  const matches = Object.entries(byOsVersion).filter(
    ([, apps]) => apps[coinApp] !== undefined,
  );

  if (matches.length === 0) {
    throw new Error(
      `No ${coinApp} version pinned for "${device}" in versions.json.`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `${coinApp} is pinned under several OS versions for "${device}" ` +
        `(${matches.map(([os]) => os).join(", ")}) in versions.json, so the pair is ambiguous.`,
    );
  }

  const [osVersion, apps] = matches[0]!;
  return { osVersion, appVersion: apps[coinApp]! };
}
