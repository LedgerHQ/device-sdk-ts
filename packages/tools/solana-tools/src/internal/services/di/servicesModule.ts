import { ContainerModule } from "inversify";

import { type AltResolverService } from "@internal/services/AltResolverService";
import { DefaultAltResolverService } from "@internal/services/DefaultAltResolverService";
import { DefaultTransactionFetcherService } from "@internal/services/DefaultTransactionFetcherService";
import { servicesTypes } from "@internal/services/di/servicesTypes";
import { type TransactionFetcherService } from "@internal/services/TransactionFetcherService";

export const servicesModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind<TransactionFetcherService>(servicesTypes.TransactionFetcherService).to(
      DefaultTransactionFetcherService,
    );
    bind<AltResolverService>(servicesTypes.AltResolverService).to(
      DefaultAltResolverService,
    );
  });
