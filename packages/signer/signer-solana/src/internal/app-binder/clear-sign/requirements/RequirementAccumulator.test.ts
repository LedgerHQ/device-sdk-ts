import { RequirementAccumulator } from "./RequirementAccumulator";

describe("RequirementAccumulator", () => {
  it("deduplicates each descriptor type by its key", () => {
    const accumulator = new RequirementAccumulator();
    accumulator.addInstructionInfo("P", "00");
    accumulator.addInstructionInfo("P", "00");
    accumulator.addEnumVariant("P", "e", 1);
    accumulator.addEnumVariant("P", "e", 1);
    accumulator.addTokenInfo("mint");
    accumulator.addTokenInfo("mint");
    accumulator.addTokenAccountState("ata");
    accumulator.addTokenAccountState("ata");
    accumulator.addAltResolution("ALT", 2);
    accumulator.addAltResolution("ALT", 2);
    accumulator.addTrustedName("name");
    accumulator.addTrustedName("name");

    const result = accumulator.build();
    expect(result.instructionInfos).toHaveLength(1);
    expect(result.enumVariants).toHaveLength(1);
    expect(result.tokenInfos).toEqual(["mint"]);
    expect(result.tokenAccountStates).toEqual(["ata"]);
    expect(result.altResolutions).toEqual([
      { altAddress: "ALT", entryIndex: 2 },
    ]);
    expect(result.trustedNames).toEqual(["name"]);
  });

  it("preserves first-seen insertion order", () => {
    const accumulator = new RequirementAccumulator();
    accumulator.addTokenInfo("c");
    accumulator.addTokenInfo("a");
    accumulator.addTokenInfo("b");
    accumulator.addTokenInfo("a");
    expect(accumulator.build().tokenInfos).toEqual(["c", "a", "b"]);
  });

  it("treats different keys of the same type as distinct", () => {
    const accumulator = new RequirementAccumulator();
    accumulator.addAltResolution("ALT", 1);
    accumulator.addAltResolution("ALT", 2);
    accumulator.addEnumVariant("P", "e", 1);
    accumulator.addEnumVariant("P", "e", 2);
    expect(accumulator.build().altResolutions).toHaveLength(2);
    expect(accumulator.build().enumVariants).toHaveLength(2);
  });

  it("returns an empty set when nothing was added", () => {
    expect(new RequirementAccumulator().build()).toEqual({
      instructionInfos: [],
      enumVariants: [],
      tokenInfos: [],
      tokenAccountStates: [],
      altResolutions: [],
      trustedNames: [],
    });
  });
});
