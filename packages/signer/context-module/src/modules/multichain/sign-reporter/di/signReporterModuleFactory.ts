import { ContainerModule } from "inversify";

import { HttpSignReporterDatasource } from "@/modules/multichain/sign-reporter/data/HttpSignReporterDatasource";
import { signReporterTypes } from "@/modules/multichain/sign-reporter/di/signReporterTypes";
import { DefaultSignReporter } from "@/modules/multichain/sign-reporter/domain/DefaultSignReporter";

export const signReporterModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(signReporterTypes.SignReporterDatasource).to(
      HttpSignReporterDatasource,
    );
    bind(signReporterTypes.SignReporter).to(DefaultSignReporter);
  });
