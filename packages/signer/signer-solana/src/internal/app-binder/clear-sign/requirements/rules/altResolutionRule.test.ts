import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import { RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";

import { applyAltResolutionRule } from "./altResolutionRule";

function run(instruction: RequirementInstruction) {
  const accumulator = new RequirementAccumulator();
  applyAltResolutionRule(instruction, accumulator);
  return accumulator.build().altResolutions;
}

describe("applyAltResolutionRule", () => {
  it("emits one ALT_RESOLUTION per ALT-supplied account, skipping static keys", () => {
    const result = run({
      programId: "P",
      data: new Uint8Array(),
      accounts: [
        { address: "static" },
        { address: undefined, altRef: { altAddress: "ALT", entryIndex: 1 } },
        { address: "resolved", altRef: { altAddress: "ALT", entryIndex: 4 } },
      ],
    });
    expect(result).toEqual([
      { altAddress: "ALT", entryIndex: 1 },
      { altAddress: "ALT", entryIndex: 4 },
    ]);
  });

  it("emits nothing when no account is ALT-supplied", () => {
    expect(
      run({
        programId: "P",
        data: new Uint8Array(),
        accounts: [{ address: "a" }],
      }),
    ).toEqual([]);
  });
});
