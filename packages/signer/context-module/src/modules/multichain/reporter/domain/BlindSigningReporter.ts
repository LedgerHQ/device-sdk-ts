import { type Either } from "purify-ts";

import { type BlindSigningReportParams } from "@/modules/multichain/reporter/data/BlindSigningReporterDatasource";

export interface BlindSigningReporter {
  report(params: BlindSigningReportParams): Promise<Either<Error, void>>;
}
