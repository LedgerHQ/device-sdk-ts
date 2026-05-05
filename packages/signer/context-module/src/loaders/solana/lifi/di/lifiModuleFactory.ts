import { ContainerModule } from "inversify";

import { HttpSolanaLifiDataSource } from "@/loaders/solana/lifi/data/HttpSolanaLifiDataSource";
import { SolanaLifiContextLoader } from "@/loaders/solana/lifi/domain/SolanaLifiContextLoader";

import { solanaLifiTypes } from "./solanaLifiTypes";

export const solanaLifiModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaLifiTypes.SolanaLifiDataSource).to(HttpSolanaLifiDataSource);
    bind(solanaLifiTypes.SolanaLifiContextLoader).to(SolanaLifiContextLoader);
  });
