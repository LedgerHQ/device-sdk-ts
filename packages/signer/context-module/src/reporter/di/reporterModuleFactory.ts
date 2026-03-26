import { ContainerModule } from "inversify";

import { HttpBlindSigningReporterDatasource } from "@/reporter/data/HttpBlindSigningReporterDatasource";
import { reporterTypes } from "@/reporter/di/reporterTypes";
import { DefaultBlindSigningReporter } from "@/reporter/domain/DefaultBlindSigningReporter";

export const reporterModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(reporterTypes.BlindSigningReporterDatasource).to(
      HttpBlindSigningReporterDatasource,
    );
    bind(reporterTypes.BlindSigningReporter).to(DefaultBlindSigningReporter);
  });
