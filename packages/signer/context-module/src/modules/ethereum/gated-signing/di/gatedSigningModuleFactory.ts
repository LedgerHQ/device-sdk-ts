import { ContainerModule } from "inversify";

import { HttpGatedDescriptorDataSource } from "@/modules/ethereum/gated-signing/data/HttpGatedDescriptorDataSource";
import { GatedSigningContextLoader } from "@/modules/ethereum/gated-signing/domain/GatedSigningContextLoader";
import { GatedSigningTypedDataContextLoader } from "@/modules/ethereum/gated-signing/domain/GatedSigningTypedDataContextLoader";

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
