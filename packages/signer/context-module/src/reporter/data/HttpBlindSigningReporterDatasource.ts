import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/network/di/networkTypes";

import {
  type BlindSigningReporterDatasource,
  type BlindSigningReportParams,
} from "./BlindSigningReporterDatasource";

@injectable()
export class HttpBlindSigningReporterDatasource
  implements BlindSigningReporterDatasource
{
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  async report(params: BlindSigningReportParams): Promise<Either<Error, void>> {
    try {
      await this.http.post(
        `${this.config.reporter.url}/blind-signing-events`,
        { ...params, source: this.config.appSource },
        { responseType: "void" },
      );
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpBlindSigningReporterDatasource: Failed to report blind signing event",
        ),
      );
    }

    return Right(undefined);
  }
}
