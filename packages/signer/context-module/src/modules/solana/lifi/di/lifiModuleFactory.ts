import { ContainerModule } from "inversify";

import { HttpLifiDataSource } from "@/modules/solana/lifi/data/HttpLifiDataSource";
import { LifiContextLoader } from "@/modules/solana/lifi/domain/LifiContextLoader";

import { lifiTypes } from "./lifiTypes";

export const lifiModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(lifiTypes.LifiDataSource).to(HttpLifiDataSource);
    bind(lifiTypes.LifiContextLoader).to(LifiContextLoader);
  });
