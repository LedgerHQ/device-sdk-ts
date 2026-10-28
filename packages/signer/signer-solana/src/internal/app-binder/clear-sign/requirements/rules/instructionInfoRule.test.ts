import { type MatchedInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import { RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";

import { applyInstructionInfoRule } from "./instructionInfoRule";

describe("applyInstructionInfoRule (deprecated)", () => {
  it("adds no requirement", () => {
    const matched = {
      instruction: { programId: "P", accounts: [], data: new Uint8Array() },
      descriptor: {
        discriminator: "ab",
        idlDescriptor: { type_pool: [], root_type: 0 },
        mintAssociations: [],
        ownerAssociations: [],
        valueFlowPorts: [],
        accountResets: [],
        displayFields: [],
        hideRules: [],
        enumCache: new Map(),
      },
    } satisfies MatchedInstruction;

    const accumulator = new RequirementAccumulator();
    const empty = accumulator.build();
    applyInstructionInfoRule(matched, accumulator);

    expect(accumulator.build()).toEqual(empty);
  });
});
