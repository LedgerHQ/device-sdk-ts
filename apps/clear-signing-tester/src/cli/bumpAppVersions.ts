import semver from "semver";

/** `default_versions.json` shape: device > OS version > coin app > app version. */
export type VersionTree = Record<
  string,
  Record<string, Record<string, string>>
>;

/** Speculinho `/catalogue` devices: device > OS version > coin app > app versions. */
export type CatalogueDevices = Record<
  string,
  { firmware: Record<string, Record<string, string[]>> }
>;

export type AppBump = {
  readonly device: string;
  readonly app: string;
  readonly fromOs: string;
  readonly toOs: string;
  readonly fromVersion: string;
  readonly toVersion: string;
};

const isStable = (version: string) =>
  semver.valid(version) !== null && semver.prerelease(version) === null;

/**
 * Pins each given app to its newest stable version on Speculinho.
 *
 * Only a new app version moves a pin. The OS changes only when the current one
 * does not carry that version, and then to the oldest stable OS that does.
 *
 * @param pins - Current `default_versions.json`
 * @param catalogue - `devices` from Speculinho's `/catalogue`
 * @param apps - Coin apps to bump, as named in `default_versions.json`
 */
export function bumpAppVersions(
  pins: VersionTree,
  catalogue: CatalogueDevices,
  apps: readonly string[],
): { pins: VersionTree; bumps: AppBump[] } {
  const next: VersionTree = structuredClone(pins);
  const bumps: AppBump[] = [];

  for (const [device, byOs] of Object.entries(pins)) {
    const firmware = Object.entries(catalogue[device]?.firmware ?? {}).filter(
      ([os]) => isStable(os),
    );

    for (const [fromOs, pinned] of Object.entries(byOs)) {
      for (const app of apps) {
        const fromVersion = pinned[app];
        if (fromVersion === undefined) continue;

        // The catalogue drops the spaces of multi-word app names.
        const name = app.replaceAll(" ", "");
        const toVersion = firmware
          .flatMap(([, available]) => available[name] ?? [])
          .filter(isStable)
          .sort(semver.rcompare)[0];
        if (!toVersion || !semver.gt(toVersion, fromVersion)) continue;

        const carriers = firmware
          .filter(([, available]) => available[name]?.includes(toVersion))
          .map(([os]) => os)
          .sort(semver.compare);
        const toOs = carriers.includes(fromOs) ? fromOs : carriers[0]!;

        const deviceNext = next[device]!;
        delete deviceNext[fromOs]![app];
        if (Object.keys(deviceNext[fromOs]!).length === 0) {
          delete deviceNext[fromOs];
        }
        deviceNext[toOs] = { ...deviceNext[toOs], [app]: toVersion };

        bumps.push({ device, app, fromOs, toOs, fromVersion, toVersion });
      }
    }
  }

  return { pins: next, bumps };
}
