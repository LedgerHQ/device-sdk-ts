import { ContainerModule } from "inversify";

import { HttpAccountOwnershipDataSource } from "@/account-ownership/data/HttpAccountOwnershipDataSource";
import { AccountOwnershipContextLoader } from "@/account-ownership/domain/AccountOwnershipContextLoader";

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
