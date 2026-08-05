import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
  type ParsedInstruction,
  ValueSource,
} from "@internal/app-binder/clear-sign/requirements/records";
import { RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";

import { applyAltResolutionRule } from "./altResolutionRule";

function emptyParsed(): ParsedInstruction {
  return {
    info: { typePool: [], rootType: 0, mintAssociations: [] },
    valueFlowPorts: [],
    accountResets: [],
    displayFields: [],
  };
}

function run(
  parsed: ParsedInstruction,
  instruction: RequirementInstruction,
): ReturnType<RequirementAccumulator["build"]>["altResolutions"] {
  const accumulator = new RequirementAccumulator();
  applyAltResolutionRule(parsed, instruction, accumulator);
  return accumulator.build().altResolutions;
}

describe("applyAltResolutionRule", () => {
  it("emits ALT_RESOLUTION for ALT-backed DISPLAY_FIELD ACCOUNT_PATH accounts", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      displayFields: [
        {
          // ACCOUNT_PATH field — account at index 1 is ALT-backed
          value: {
            source: ValueSource.ACCOUNT_PATH,
            payload: Uint8Array.from([1]),
          },
        },
        {
          // Another ACCOUNT_PATH field — account at index 0 is static
          value: {
            source: ValueSource.ACCOUNT_PATH,
            payload: Uint8Array.from([0]),
          },
        },
      ],
    };
    const instruction: RequirementInstruction = {
      programId: "P",
      data: new Uint8Array(),
      accounts: [
        { address: "static" },
        { altRef: { altAddress: "ALT", entryIndex: 3 } },
      ],
    };
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 3 },
    ]);
  });

  it("emits ALT_RESOLUTION for ALT-backed MINT_ASSOCIATION token-account positions", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      info: {
        typePool: [],
        rootType: 0,
        mintAssociations: [{ accountIndex: 0, mintIndex: 1 }],
      },
    };
    const instruction: RequirementInstruction = {
      programId: "P",
      data: new Uint8Array(),
      accounts: [
        { altRef: { altAddress: "ALT", entryIndex: 5 } }, // token account
        { altRef: { altAddress: "ALT", entryIndex: 7 } }, // mint — NOT emitted here
      ],
    };
    // Only the token-account position (accountIndex=0) is emitted; the
    // mint position (mintIndex=1) is handled by the mintAltRef pass.
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 5 },
    ]);
  });

  it("does not emit ALT_RESOLUTION for accounts not referenced by display fields or MINT_ASSOC", () => {
    // All accounts are ALT-backed but none appear in display fields or MINT_ASSOC
    const parsed: ParsedInstruction = emptyParsed();
    const instruction: RequirementInstruction = {
      programId: "P",
      data: new Uint8Array(),
      accounts: [
        { altRef: { altAddress: "ALT", entryIndex: 1 } },
        { altRef: { altAddress: "ALT", entryIndex: 2 } },
      ],
    };
    expect(run(parsed, instruction)).toEqual([]);
  });

  it("emits nothing when no account is ALT-supplied", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      displayFields: [
        {
          value: {
            source: ValueSource.ACCOUNT_PATH,
            payload: Uint8Array.from([0]),
          },
        },
      ],
    };
    expect(
      run(parsed, {
        programId: "P",
        data: new Uint8Array(),
        accounts: [{ address: "static" }],
      }),
    ).toEqual([]);
  });
});
