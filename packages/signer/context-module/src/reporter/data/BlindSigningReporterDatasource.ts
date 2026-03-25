import { type Either } from "purify-ts";

import { type BlindSigningEventDto } from "./dto/BlindSigningEventDto";

export type BlindSigningReportParams = BlindSigningEventDto;

export interface BlindSigningReporterDatasource {
  report(params: BlindSigningReportParams): Promise<Either<Error, void>>;
}
