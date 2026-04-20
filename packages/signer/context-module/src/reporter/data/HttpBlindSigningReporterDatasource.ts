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
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
  ) {}

  async report(params: BlindSigningReportParams): Promise<Either<Error, void>> {
    try {
      const response = await fetch(
        `${this.config.reporter.url}/blind-signing-events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
            [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
          },
          body: JSON.stringify({ ...params, source: this.config.appSource }),
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
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
