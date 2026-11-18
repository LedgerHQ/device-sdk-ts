import { ContainerModule } from "inversify";

import { HttpSolanaGatedDescriptorDataSource } from "@/modules/multichain/gated-signing/data/HttpSolanaGatedDescriptorDataSource";
import { SolanaGatedSigningContextLoader } from "@/modules/multichain/gated-signing/loaders/SolanaGatedSigningContextLoader";

import { gatedSigningTypes } from "./gatedSigningTypes";

export const solanaGatedSigningModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(gatedSigningTypes.SolanaGatedDescriptorDataSource).to(
      HttpSolanaGatedDescriptorDataSource,
    );
    bind(gatedSigningTypes.SolanaGatedSigningContextLoader).to(
      SolanaGatedSigningContextLoader,
    );
  });
