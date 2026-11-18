import { ContainerModule } from "inversify";

import { HttpGatedDescriptorDataSource } from "@/modules/multichain/gated-signing/data/HttpGatedDescriptorDataSource";
import { GatedSigningContextLoader } from "@/modules/multichain/gated-signing/loaders/GatedSigningContextLoader";
import { GatedSigningTypedDataContextLoader } from "@/modules/multichain/gated-signing/loaders/GatedSigningTypedDataContextLoader";

import { gatedSigningTypes } from "./gatedSigningTypes";

export const ethereumGatedSigningModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(gatedSigningTypes.GatedDescriptorDataSource).to(
      HttpGatedDescriptorDataSource,
    );
    bind(gatedSigningTypes.GatedSigningContextLoader).to(
      GatedSigningContextLoader,
    );
    bind(gatedSigningTypes.GatedSigningTypedDataContextLoader).to(
      GatedSigningTypedDataContextLoader,
    );
  });
