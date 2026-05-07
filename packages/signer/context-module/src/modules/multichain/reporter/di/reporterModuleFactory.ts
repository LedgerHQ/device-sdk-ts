import { ContainerModule } from "inversify";

import { HttpBlindSigningReporterDatasource } from "@/modules/multichain/reporter/data/HttpBlindSigningReporterDatasource";
import { reporterTypes } from "@/modules/multichain/reporter/di/reporterTypes";
import { DefaultBlindSigningReporter } from "@/modules/multichain/reporter/domain/DefaultBlindSigningReporter";

export const reporterModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(reporterTypes.BlindSigningReporterDatasource).to(
      HttpBlindSigningReporterDatasource,
    );
    bind(reporterTypes.BlindSigningReporter).to(DefaultBlindSigningReporter);
  });
