import { ContainerModule } from "inversify";

import { HttpConcordiumAccountOwnershipDataSource } from "@/loaders/concordium/account-ownership/data/HttpConcordiumAccountOwnershipDataSource";
import { ConcordiumAccountOwnershipContextLoader } from "@/loaders/concordium/account-ownership/domain/ConcordiumAccountOwnershipContextLoader";

import { concordiumAccountOwnershipTypes } from "./concordiumAccountOwnershipTypes";

export const concordiumAccountOwnershipModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(
      concordiumAccountOwnershipTypes.ConcordiumAccountOwnershipDataSource,
    ).to(HttpConcordiumAccountOwnershipDataSource);
    bind(
      concordiumAccountOwnershipTypes.ConcordiumAccountOwnershipContextLoader,
    ).to(ConcordiumAccountOwnershipContextLoader);
  });
