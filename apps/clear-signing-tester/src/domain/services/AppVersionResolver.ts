import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";

export type ResolvedAppVersion = {
  os: string;
  version: string;
  path: string;
};

/**
 * Service responsible for resolving Ethereum app versions and OS versions
 * based on the available apps in the filesystem.
 */
export interface AppVersionResolver {
  /**
   * Resolves the app version and OS version based on the provided parameters.
   *
   * @param device - The device type
   * @param requestedOs - The requested OS version (optional)
   * @param requestedVersion - The requested app version (optional)
   * @returns The resolved OS version, app version, and full path to the app
   * @throws Error if no compatible app is found
   *
   * Resolution logic:
   * - If both OS and version are provided, validates they exist
   * - If only OS is provided, finds the latest app version for that OS
   * - If only version is provided, finds the latest OS with that app version
   * - If neither is provided, finds the latest OS and app version
   */
  resolve(
    device: SpeculosConfig["device"],
    requestedOs?: string,
    requestedVersion?: string,
  ): ResolvedAppVersion;
}
