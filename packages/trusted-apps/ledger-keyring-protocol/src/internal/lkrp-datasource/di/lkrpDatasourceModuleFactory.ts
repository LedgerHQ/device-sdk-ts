import { ContainerModule } from "inversify";

import { type MakeContainerProps } from "@internal/di";
import { HttpLKRPDataSource } from "@internal/lkrp-datasource/data/HttpLKRPDataSource";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";

import { lkrpDatasourceTypes } from "./lkrpDatasourceTypes";

export const lkrpDatasourceModuleFactory = ({
  baseUrl,
}: Pick<MakeContainerProps, "stub" | "baseUrl">) =>
  new ContainerModule(({ bind }) => {
    bind<LKRPDataSource>(lkrpDatasourceTypes.LKRPDataSource).to(
      HttpLKRPDataSource,
    );
    bind(lkrpDatasourceTypes.BaseUrl).toConstantValue(baseUrl);
  });
