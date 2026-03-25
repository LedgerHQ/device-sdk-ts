import { ContainerModule } from "inversify";

import { HttpBlindSigningReporterDatasource } from "@/reporter/data/HttpBlindSigningReporterDatasource";
import { reporterTypes } from "@/reporter/di/reporterTypes";

export const reporterModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(reporterTypes.BlindSigningReporterDatasource).to(
      HttpBlindSigningReporterDatasource,
    );
  });
