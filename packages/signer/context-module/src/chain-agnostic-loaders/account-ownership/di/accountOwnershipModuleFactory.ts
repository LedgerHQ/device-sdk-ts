import { ContainerModule } from "inversify";

import { HttpAccountOwnershipDataSource } from "@/chain-agnostic-loaders/account-ownership/data/HttpAccountOwnershipDataSource";
import { AccountOwnershipContextLoader } from "@/chain-agnostic-loaders/account-ownership/domain/AccountOwnershipContextLoader";

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
