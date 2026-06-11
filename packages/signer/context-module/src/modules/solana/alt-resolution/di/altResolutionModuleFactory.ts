import { ContainerModule } from "inversify";

import { HttpAltResolutionDataSource } from "@/modules/solana/alt-resolution/data/HttpAltResolutionDataSource";
import { altResolutionTypes } from "@/modules/solana/alt-resolution/di/altResolutionTypes";
import { AltResolutionContextLoader } from "@/modules/solana/alt-resolution/domain/AltResolutionContextLoader";

export const altResolutionModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(altResolutionTypes.AltResolutionDataSource).to(
      HttpAltResolutionDataSource,
    );
    bind(altResolutionTypes.AltResolutionContextLoader).to(
      AltResolutionContextLoader,
    );
  });
