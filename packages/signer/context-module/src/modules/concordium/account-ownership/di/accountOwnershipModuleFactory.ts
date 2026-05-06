import { ContainerModule } from "inversify";

import { HttpAccountOwnershipDataSource } from "@/modules/concordium/account-ownership/data/HttpAccountOwnershipDataSource";
import { AccountOwnershipContextLoader } from "@/modules/concordium/account-ownership/domain/AccountOwnershipContextLoader";

import { accountOwnershipTypes } from "./accountOwnershipTypes";

export const accountOwnershipModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(accountOwnershipTypes.AccountOwnershipDataSource).to(
      HttpAccountOwnershipDataSource,
    );
    bind(accountOwnershipTypes.AccountOwnershipContextLoader).to(
      AccountOwnershipContextLoader,
    );
  });
