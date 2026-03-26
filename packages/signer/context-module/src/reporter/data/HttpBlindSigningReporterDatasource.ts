import axios from "axios";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ResolvedContextModuleConfig } from "@/config/model/ContextModuleConfig";
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
    private readonly config: ResolvedContextModuleConfig,
  ) {}

  async report(params: BlindSigningReportParams): Promise<Either<Error, void>> {
    try {
      await axios.request({
        method: "POST",
        url: `${this.config.reporter.url}/v1/blind-signing-events`,
        data: params,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });
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
