import { ContainerModule } from "inversify";

import { HttpGatedDescriptorDataSource } from "@/loaders/ethereum/gated-signing/data/HttpGatedDescriptorDataSource";
import { GatedSigningContextLoader } from "@/loaders/ethereum/gated-signing/domain/GatedSigningContextLoader";
import { GatedSigningTypedDataContextLoader } from "@/loaders/ethereum/gated-signing/domain/GatedSigningTypedDataContextLoader";

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
