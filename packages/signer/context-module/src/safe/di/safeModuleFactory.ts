import { ContainerModule } from "inversify";

import { SafeProxyDataSource } from "@/safe/data/SafeProxyDataSource";
import { safeTypes } from "@/safe/di/safeTypes";
import { SafeProxyContextFieldLoader } from "@/safe/domain/SafeProxyContextFieldLoader";
import { SafeTransactionContextLoader } from "@/safe/domain/SafeTransactionContextLoader";

export const safeModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(safeTypes.SafeProxyDataSource).to(SafeProxyDataSource);
    bind(safeTypes.SafeTransactionContextLoader).to(
      SafeTransactionContextLoader,
    );
    bind(safeTypes.SafeProxyContextFieldLoader).to(SafeProxyContextFieldLoader);
  });
