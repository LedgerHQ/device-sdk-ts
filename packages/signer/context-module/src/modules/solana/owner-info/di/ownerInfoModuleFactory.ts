import { ContainerModule } from "inversify";

import { HttpOwnerInfoDataSource } from "@/modules/solana/owner-info/data/HttpOwnerInfoDataSource";
import { ownerInfoTypes } from "@/modules/solana/owner-info/di/ownerInfoTypes";
import { OwnerInfoContextLoader } from "@/modules/solana/owner-info/domain/OwnerInfoContextLoader";

export const ownerInfoModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ownerInfoTypes.OwnerInfoDataSource).to(HttpOwnerInfoDataSource);
    bind(ownerInfoTypes.OwnerInfoContextLoader).to(OwnerInfoContextLoader);
  });
