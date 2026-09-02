import { coerce, gt, gte, valid } from "semver";

import { type DeviceModelId } from "@api/device/DeviceModel";
import { type DeviceSessionState } from "@api/device-session/DeviceSessionState";

import {
  type AppConfig,
  type ApplicationResolver,
} from "./ApplicationResolver";

export class ApplicationChecker {
  private isCompatible: boolean;
  private version: string;
  private modelId: DeviceModelId;
  private readonly appName: string | undefined;

  constructor(
    deviceState: DeviceSessionState,
    appConfig: AppConfig,
    resolver: ApplicationResolver,
  ) {
    this.modelId = deviceState.deviceModelId;
    this.appName =
      "currentApp" in deviceState ? deviceState.currentApp.name : undefined;
    const resolved = resolver.resolve(deviceState, appConfig);
    this.isCompatible = resolved.isCompatible;
    this.version = resolved.version;
  }

  withMinVersionInclusive(version: string): ApplicationChecker {
    if (!gte(this.version, version)) this.isCompatible = false;
    return this;
  }

  withMinVersionExclusive(version: string): ApplicationChecker {
    if (!gt(this.version, version)) this.isCompatible = false;
    return this;
  }

  /**
   * Like {@link withMinVersionInclusive}, but compares only the release core:
   * prerelease and build tags are stripped from both sides first, so an app
   * reporting `1.23.0-rc2` or `1.23.0-dev` satisfies a `1.23.0` minimum.
   *
   * This accepts a prerelease *of* the minimum, not any prerelease: the core
   * still has to clear the bar, so `1.22.9-rc5` fails a `1.23.0` minimum just
   * as `1.22.9` does. A version neither side can parse fails the check, so an
   * unknown version never passes.
   *
   * Use this when a feature lands in a given release and devices running its
   * release candidates must not be locked out — device versions reach the SDK
   * verbatim, tags included (`GET APP AND VERSION` yields strings such as
   * `1.4.0-rc2`). Prefer the strict {@link withMinVersionInclusive} when a
   * prerelease genuinely cannot be trusted to carry the feature.
   */
  withMinVersionInclusiveAcceptingPrerelease(
    version: string,
  ): ApplicationChecker {
    const actual = valid(coerce(this.version));
    const minimum = valid(coerce(version));
    if (actual === null || minimum === null || !gte(actual, minimum)) {
      this.isCompatible = false;
    }
    return this;
  }

  excludeDeviceModel(modelId: DeviceModelId): ApplicationChecker {
    if (this.modelId === modelId) this.isCompatible = false;
    return this;
  }

  excludeDeviceModels(...modelIds: DeviceModelId[]): ApplicationChecker {
    for (const id of modelIds) this.excludeDeviceModel(id);
    return this;
  }

  excludeApp(name: string): ApplicationChecker {
    if (this.appName === name) this.isCompatible = false;
    return this;
  }

  excludeApps(...names: string[]): ApplicationChecker {
    for (const name of names) this.excludeApp(name);
    return this;
  }

  check(): boolean {
    return this.isCompatible;
  }
}
