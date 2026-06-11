import { ContainerModule } from "inversify";

import { HttpTokenAccountStateDataSource } from "@/modules/solana/token-account-state/data/HttpTokenAccountStateDataSource";
import { tokenAccountStateTypes } from "@/modules/solana/token-account-state/di/tokenAccountStateTypes";
import { TokenAccountStateContextLoader } from "@/modules/solana/token-account-state/domain/TokenAccountStateContextLoader";

export const tokenAccountStateModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(tokenAccountStateTypes.TokenAccountStateDataSource).to(
      HttpTokenAccountStateDataSource,
    );
    bind(tokenAccountStateTypes.TokenAccountStateContextLoader).to(
      TokenAccountStateContextLoader,
    );
  });
