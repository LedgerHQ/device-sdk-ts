import { ContainerModule } from "inversify";

import { HttpBlindSigningReporterDatasource } from "@/chain-agnostic-loaders/reporter/data/HttpBlindSigningReporterDatasource";
import { reporterTypes } from "@/chain-agnostic-loaders/reporter/di/reporterTypes";
import { DefaultBlindSigningReporter } from "@/chain-agnostic-loaders/reporter/domain/DefaultBlindSigningReporter";

export const reporterModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(reporterTypes.BlindSigningReporterDatasource).to(
      HttpBlindSigningReporterDatasource,
    );
    bind(reporterTypes.BlindSigningReporter).to(DefaultBlindSigningReporter);
  });
