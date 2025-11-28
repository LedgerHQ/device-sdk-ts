import { ContainerModule } from "inversify";

import { HttpSolanaLifiDataSource } from "@/solanaLifi/data/HttpSolanaLifiDataSource";
import { SolanaLifiContextLoader } from "@/solanaLifi/domain/SolanaLifiContextLoader";

import { lifiTypes } from "./solanaLifiTypes";

export const solanaLifiModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(lifiTypes.SolanaLifiDataSource).to(HttpSolanaLifiDataSource);
    bind(lifiTypes.SolanaLifiContextLoader).to(SolanaLifiContextLoader);
  });
