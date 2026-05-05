import { ContainerModule } from "inversify";

import { HttpBlindSigningReporterDatasource } from "@/loaders/chain-agnostic/reporter/data/HttpBlindSigningReporterDatasource";
import { reporterTypes } from "@/loaders/chain-agnostic/reporter/di/reporterTypes";
import { DefaultBlindSigningReporter } from "@/loaders/chain-agnostic/reporter/domain/DefaultBlindSigningReporter";

export const reporterModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(reporterTypes.BlindSigningReporterDatasource).to(
      HttpBlindSigningReporterDatasource,
    );
    bind(reporterTypes.BlindSigningReporter).to(DefaultBlindSigningReporter);
  });
