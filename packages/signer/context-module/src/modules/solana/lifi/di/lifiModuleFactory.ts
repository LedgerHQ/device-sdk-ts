import { ContainerModule } from "inversify";

import { HttpSolanaLifiDataSource } from "@/modules/solana/lifi/data/HttpSolanaLifiDataSource";
import { SolanaLifiContextLoader } from "@/modules/solana/lifi/domain/SolanaLifiContextLoader";

import { solanaLifiTypes } from "./solanaLifiTypes";

export const solanaLifiModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaLifiTypes.SolanaLifiDataSource).to(HttpSolanaLifiDataSource);
    bind(solanaLifiTypes.SolanaLifiContextLoader).to(SolanaLifiContextLoader);
  });
