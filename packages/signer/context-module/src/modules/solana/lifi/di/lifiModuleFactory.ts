import { ContainerModule } from "inversify";

import { HttpLifiDataSource } from "@/modules/solana/lifi/data/HttpLifiDataSource";
import { LifiContextLoader } from "@/modules/solana/lifi/domain/LifiContextLoader";

import { solanaLifiTypes } from "./solanaLifiTypes";

export const lifiModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaLifiTypes.SolanaLifiDataSource).to(HttpLifiDataSource);
    bind(solanaLifiTypes.SolanaLifiContextLoader).to(LifiContextLoader);
  });
