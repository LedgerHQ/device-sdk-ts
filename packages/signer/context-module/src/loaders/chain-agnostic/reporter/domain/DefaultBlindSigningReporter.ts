import { inject, injectable } from "inversify";
import { type Either } from "purify-ts";

import {
  type BlindSigningReporterDatasource,
  type BlindSigningReportParams,
} from "@/loaders/chain-agnostic/reporter/data/BlindSigningReporterDatasource";
import { reporterTypes } from "@/loaders/chain-agnostic/reporter/di/reporterTypes";

import { type BlindSigningReporter } from "./BlindSigningReporter";

@injectable()
export class DefaultBlindSigningReporter implements BlindSigningReporter {
  constructor(
    @inject(reporterTypes.BlindSigningReporterDatasource)
    private readonly dataSource: BlindSigningReporterDatasource,
  ) {}

  async report(params: BlindSigningReportParams): Promise<Either<Error, void>> {
    return this.dataSource.report(params);
  }
}
