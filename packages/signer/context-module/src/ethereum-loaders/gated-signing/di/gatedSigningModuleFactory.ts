import { ContainerModule } from "inversify";

import { HttpGatedDescriptorDataSource } from "@/ethereum-loaders/gated-signing/data/HttpGatedDescriptorDataSource";
import { GatedSigningContextLoader } from "@/ethereum-loaders/gated-signing/domain/GatedSigningContextLoader";
import { GatedSigningTypedDataContextLoader } from "@/ethereum-loaders/gated-signing/domain/GatedSigningTypedDataContextLoader";

import { ethereumGatedSigningTypes } from "./ethereumGatedSigningTypes";

export const gatedSigningModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumGatedSigningTypes.EthereumGatedDescriptorDataSource).to(
      HttpGatedDescriptorDataSource,
    );
    bind(ethereumGatedSigningTypes.EthereumGatedSigningContextLoader).to(
      GatedSigningContextLoader,
    );
    bind(
      ethereumGatedSigningTypes.EthereumGatedSigningTypedDataContextLoader,
    ).to(GatedSigningTypedDataContextLoader);
  });
