import { inject, injectable } from "inversify";
import { type Either } from "purify-ts";

import { type SignReporterDatasource } from "@/modules/multichain/sign-reporter/data/SignReporterDatasource";
import { signReporterTypes } from "@/modules/multichain/sign-reporter/di/signReporterTypes";
import { type SignReportParams } from "@/modules/multichain/sign-reporter/model/SignReportParams";

import { type SignReporter } from "./SignReporter";

@injectable()
export class DefaultSignReporter implements SignReporter {
  constructor(
    @inject(signReporterTypes.SignReporterDatasource)
    private readonly dataSource: SignReporterDatasource,
  ) {}

  async report(params: SignReportParams): Promise<Either<Error, void>> {
    return this.dataSource.report(params);
  }
}
