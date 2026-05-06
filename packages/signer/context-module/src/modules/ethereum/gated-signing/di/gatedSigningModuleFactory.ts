import { ContainerModule } from "inversify";

import { HttpGatedDescriptorDataSource } from "@/modules/ethereum/gated-signing/data/HttpGatedDescriptorDataSource";
import { GatedSigningContextLoader } from "@/modules/ethereum/gated-signing/domain/GatedSigningContextLoader";
import { GatedSigningTypedDataContextLoader } from "@/modules/ethereum/gated-signing/domain/GatedSigningTypedDataContextLoader";

import { gatedSigningTypes } from "./gatedSigningTypes";

export const gatedSigningModuleFactory = () =>
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
