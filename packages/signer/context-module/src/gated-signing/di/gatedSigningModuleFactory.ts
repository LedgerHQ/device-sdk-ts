import { ContainerModule } from "inversify";

import { HttpGatedDescriptorDataSource } from "@/gated-signing/data/HttpGatedDescriptorDataSource";
import { GatedSigningContextLoader } from "@/gated-signing/domain/GatedSigningContextLoader";

import { gatedSigningTypes } from "./gatedSigningTypes";

export const gatedSigningModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(gatedSigningTypes.GatedDescriptorDataSource).to(
      HttpGatedDescriptorDataSource,
    );
    bind(gatedSigningTypes.GatedSigningContextLoader).to(
      GatedSigningContextLoader,
    );
  });
