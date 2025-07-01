import { ContainerModule } from "inversify";

import { HttpLKRPDataSource } from "@internal/lkrp-datasource/data/HttpLKRPDataSource";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";

import { lkrpDatasourceTypes } from "./lkrpDatasourceTypes";
import { MakeContainerProps } from "@internal/di";

export const lkrpDatasourceModuleFactory = ({
  baseUrl,
}: Pick<MakeContainerProps, "stub" | "baseUrl">) =>
  new ContainerModule(({ bind }) => {
    bind<LKRPDataSource>(lkrpDatasourceTypes.LKRPDataSource).to(
      HttpLKRPDataSource,
    );
    bind(lkrpDatasourceTypes.BaseUrl).toConstantValue(baseUrl);
  });
