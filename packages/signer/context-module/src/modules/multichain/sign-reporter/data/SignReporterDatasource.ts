import { type Either } from "purify-ts";

import { type SignReportParams } from "@/modules/multichain/sign-reporter/model/SignReportParams";

export interface SignReporterDatasource {
  report(params: SignReportParams): Promise<Either<Error, void>>;
}
