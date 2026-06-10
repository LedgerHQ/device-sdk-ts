import { ContainerModule } from "inversify";

import { enumVariantTypes } from "@/modules/solana/enum-variant/di/enumVariantTypes";
import { EnumVariantContextLoader } from "@/modules/solana/enum-variant/domain/EnumVariantContextLoader";

// EnumVariantContextLoader shares InstructionInfoDataSource — its binding
// is owned by `instructionInfoModuleFactory` and reused here via DI.
export const enumVariantModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(enumVariantTypes.EnumVariantContextLoader).to(
      EnumVariantContextLoader,
    );
  });
