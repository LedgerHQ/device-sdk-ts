import { ContainerModule } from "inversify";

import { HttpAccountOwnershipDataSource } from "@/modules/concordium/account-ownership/data/HttpAccountOwnershipDataSource";
import { AccountOwnershipContextLoader } from "@/modules/concordium/account-ownership/domain/AccountOwnershipContextLoader";

import { concordiumAccountOwnershipTypes } from "./concordiumAccountOwnershipTypes";

export const accountOwnershipModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(
      concordiumAccountOwnershipTypes.ConcordiumAccountOwnershipDataSource,
    ).to(HttpAccountOwnershipDataSource);
    bind(
      concordiumAccountOwnershipTypes.ConcordiumAccountOwnershipContextLoader,
    ).to(AccountOwnershipContextLoader);
  });
