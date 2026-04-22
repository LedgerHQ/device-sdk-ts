import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import {
  type BlindSigningReporterDatasource,
  type BlindSigningReportParams,
} from "./BlindSigningReporterDatasource";

@injectable()
export class HttpBlindSigningReporterDatasource
  implements BlindSigningReporterDatasource
{
  private readonly http: DmkNetworkClient;

  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
  ) {
    this.http = new DmkNetworkClient({
      headers: {
        [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        ...(this.config.originToken && {
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        }),
      },
    });
  }

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
