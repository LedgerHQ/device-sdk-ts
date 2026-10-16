import { ContainerModule } from "inversify";

import { HttpInstructionInfoDataSource } from "@/modules/solana/instruction-info/data/HttpInstructionInfoDataSource";
import { instructionInfoTypes } from "@/modules/solana/instruction-info/di/instructionInfoTypes";
import { InstructionInfoContextLoader } from "@/modules/solana/instruction-info/domain/InstructionInfoContextLoader";
import { SolanaBasicFlowRulesLoader } from "@/modules/solana/instruction-info/domain/SolanaBasicFlowRulesLoader";

export const instructionInfoModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    // Singleton so every consumer (instruction-info, enum-variant and
    // basic-flow rules loaders) shares the data source's response cache.
    bind(instructionInfoTypes.InstructionInfoDataSource)
      .to(HttpInstructionInfoDataSource)
      .inSingletonScope();
    bind(instructionInfoTypes.InstructionInfoContextLoader).to(
      InstructionInfoContextLoader,
    );
    bind(instructionInfoTypes.SolanaBasicFlowRulesLoader).to(
      SolanaBasicFlowRulesLoader,
    );
  });
