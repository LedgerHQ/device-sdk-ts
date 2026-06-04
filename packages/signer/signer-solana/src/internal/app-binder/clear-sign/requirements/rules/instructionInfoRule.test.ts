import { type MatchedInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import { RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";

import { applyInstructionInfoRule } from "./instructionInfoRule";

describe("applyInstructionInfoRule", () => {
  it("records the instruction's (programId, discriminator)", () => {
    const matched = {
      instruction: { programId: "P", accounts: [], data: new Uint8Array() },
      descriptor: {
        discriminator: "ab",
        instructionInfo: new Uint8Array(),
        substructures: [],
        enumCache: new Map(),
      },
    } satisfies MatchedInstruction;

    const accumulator = new RequirementAccumulator();
    applyInstructionInfoRule(matched, accumulator);
    expect(accumulator.build().instructionInfos).toEqual([
      { programId: "P", discriminator: "ab" },
    ]);
  });
});
