/**
 * Newest first, numerically (`1.10.0` above `1.9.1`). A pre-release such as
 * `1.7.0-rc2` sorts below its release, and pre-releases among themselves by
 * their suffix.
 */
export const byNewest = (a: string, b: string): number => {
  const [baseA = "", preA] = a.split(/-(.*)/);
  const [baseB = "", preB] = b.split(/-(.*)/);
  const partsA = baseA.split(".").map(Number);
  const partsB = baseB.split(".").map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const diff = (partsB[i] ?? 0) - (partsA[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (preA === undefined || preB === undefined) {
    return preA === undefined ? (preB === undefined ? 0 : -1) : 1;
  }
  return preB.localeCompare(preA, undefined, { numeric: true });
};

/** Whether a version is a release candidate or other pre-release build. */
export const isPreRelease = (version: string): boolean => version.includes("-");
