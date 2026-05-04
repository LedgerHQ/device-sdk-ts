import { ContainerModule } from "inversify";

import { HttpSolanaLifiDataSource } from "@/solana-loaders/lifi/data/HttpSolanaLifiDataSource";
import { SolanaLifiContextLoader } from "@/solana-loaders/lifi/domain/SolanaLifiContextLoader";

import { solanaLifiTypes } from "./solanaLifiTypes";

export const solanaLifiModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaLifiTypes.SolanaLifiDataSource).to(HttpSolanaLifiDataSource);
    bind(solanaLifiTypes.SolanaLifiContextLoader).to(SolanaLifiContextLoader);
  });
