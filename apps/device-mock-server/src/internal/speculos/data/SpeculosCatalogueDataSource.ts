import { type EitherAsync } from "purify-ts";

import { type SpeculosError } from "@internal/speculos/model/SpeculosModels";

/** Port for Speculinho's `/catalogue`: the app builds its Speculos image carries. */
export interface SpeculosCatalogueDataSource {
  /**
   * Firmware versions Speculinho can boot on one model. Empty for a model it
   * carries nothing for.
   *
   * @param device - Speculinho model id (`nanox`, `nanos+`, `apex_p`, ...)
   */
  firmwareVersions(device: string): EitherAsync<SpeculosError, string[]>;

  /**
   * App versions Speculinho can boot on one model and OS, keyed by coin app.
   * Empty when it carries no build of that OS.
   *
   * @param device - Speculinho model id (`nanox`, `nanos+`, `apex_p`, ...)
   * @param osVersion - Firmware version, verbatim
   */
  appVersions(
    device: string,
    osVersion: string,
  ): EitherAsync<SpeculosError, Record<string, string[]>>;
}
