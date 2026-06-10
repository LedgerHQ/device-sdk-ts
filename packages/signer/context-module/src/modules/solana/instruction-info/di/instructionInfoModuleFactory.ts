import { ContainerModule } from "inversify";

import { HttpInstructionInfoDataSource } from "@/modules/solana/instruction-info/data/HttpInstructionInfoDataSource";
import { instructionInfoTypes } from "@/modules/solana/instruction-info/di/instructionInfoTypes";
import { InstructionInfoContextLoader } from "@/modules/solana/instruction-info/domain/InstructionInfoContextLoader";

export const instructionInfoModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(instructionInfoTypes.InstructionInfoDataSource).to(
      HttpInstructionInfoDataSource,
    );
    bind(instructionInfoTypes.InstructionInfoContextLoader).to(
      InstructionInfoContextLoader,
    );
  });
