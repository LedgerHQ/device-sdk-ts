import {
  type RequirementAccount,
  type RequirementInstruction,
} from "@internal/app-binder/clear-sign/requirements/model";
import {
  OptionalAccountStrategy,
  PARAM_TYPE_TOKEN_AMOUNT,
  type ParsedInstruction,
  TokenKind,
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

/** An ALT-backed slot at `entryIndex` of the "ALT" table. */
function alt(entryIndex: number, isWritable = false): RequirementAccount {
  return { altRef: { altAddress: "ALT", entryIndex }, isWritable };
}

/** A statically resolved slot. */
function addr(address: string, isWritable = false): RequirementAccount {
  return { address, isWritable };
}

function accountPath(index: number) {
  return {
    source: ValueSource.ACCOUNT_PATH,
    payload: Uint8Array.from([index]),
  };
}

function instructionOf(
  accounts: RequirementAccount[],
  programId = "P",
): RequirementInstruction {
  return { programId, accounts, data: new Uint8Array() };
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
  it("emits ALT_RESOLUTION for a writable ALT account named by nothing", () => {
    // Regression: the device's writable-account walk dereferences every
    // writable slot; an unresolved one marks the list incomplete and stops the
    // merge scan.
    const instruction = instructionOf([
      addr("static", true),
      alt(3, true),
      alt(9),
    ]);
    expect(run(emptyParsed(), instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 3 },
    ]);
  });

  it("emits nothing for a read-only ALT account named by nothing", () => {
    const instruction = instructionOf([alt(1), alt(2)]);
    expect(run(emptyParsed(), instruction)).toEqual([]);
  });

  it("emits ALT_RESOLUTION for ALT-backed DISPLAY_FIELD ACCOUNT_PATH accounts", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      displayFields: [
        // ACCOUNT_PATH field — account at index 1 is ALT-backed
        { value: accountPath(1) },
        // Another ACCOUNT_PATH field — account at index 0 is static
        { value: accountPath(0) },
      ],
    };
    const instruction = instructionOf([addr("static"), alt(3)]);
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 3 },
    ]);
  });

  it("emits ALT_RESOLUTION for every ALT-backed candidate of a port", () => {
    // The device walks the candidate array in order and refuses on the first
    // in-range candidate it cannot resolve, so all of them are requested.
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      valueFlowPorts: [
        {
          accountIndices: [0, 1, 2],
          optionalAccountStrategy: OptionalAccountStrategy.PROGRAM_ID,
        },
      ],
    };
    const instruction = instructionOf([alt(1), addr("static"), alt(2)]);
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 1 },
      { altAddress: "ALT", entryIndex: 2 },
    ]);
  });

  it("emits ALT_RESOLUTION for a RESOLVE port's token account", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      valueFlowPorts: [
        {
          accountIndices: [0],
          optionalAccountStrategy: OptionalAccountStrategy.PROGRAM_ID,
          tokenValue: { kind: TokenKind.RESOLVE, accountIndex: 2 },
        },
      ],
    };
    const instruction = instructionOf([addr("port"), addr("other"), alt(6)]);
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 6 },
    ]);
  });

  it("falls back to the port's own account when a RESOLVE port carries no token account", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      valueFlowPorts: [
        {
          accountIndices: [1],
          optionalAccountStrategy: OptionalAccountStrategy.PROGRAM_ID,
          tokenValue: { kind: TokenKind.RESOLVE },
        },
      ],
    };
    const instruction = instructionOf([addr("static"), alt(4)]);
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 4 },
    ]);
  });

  it("emits ALT_RESOLUTION for an ACCOUNT_PATH port token value", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      valueFlowPorts: [
        {
          accountIndices: [0],
          optionalAccountStrategy: OptionalAccountStrategy.PROGRAM_ID,
          tokenValue: { kind: TokenKind.DIRECT, value: accountPath(1) },
        },
      ],
    };
    const instruction = instructionOf([addr("port"), alt(8)]);
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 8 },
    ]);
  });

  it("emits ALT_RESOLUTION for a PARAM_TOKEN_AMOUNT ACCOUNT_PATH token reference", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      displayFields: [
        { paramType: PARAM_TYPE_TOKEN_AMOUNT, token: accountPath(1) },
      ],
    };
    const instruction = instructionOf([addr("static"), alt(11)]);
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 11 },
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
    // token account at 0, mint at 1 — the mint is NOT emitted here
    const instruction = instructionOf([alt(5), alt(7)]);
    // Only the token-account position (accountIndex=0) is emitted; the
    // mint position (mintIndex=1) is handled by the mintAltRef pass.
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 5 },
    ]);
  });

  it("emits ALT_RESOLUTION for an ALT-backed ACCOUNT_RESET target", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      accountResets: [{ accountIndex: 1, requirePreBalanceZero: false }],
    };
    const instruction = instructionOf([addr("static"), alt(12)]);
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 12 },
    ]);
  });

  it("emits one requirement for an ALT entry reached through several categories", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      valueFlowPorts: [
        {
          accountIndices: [0],
          optionalAccountStrategy: OptionalAccountStrategy.PROGRAM_ID,
          tokenValue: { kind: TokenKind.RESOLVE, accountIndex: 0 },
        },
      ],
      accountResets: [{ accountIndex: 0, requirePreBalanceZero: false }],
      displayFields: [{ value: accountPath(0) }],
    };
    // Writable, port candidate, port token account, reset target and display
    // field all point at the same slot.
    const instruction = instructionOf([alt(2, true)]);
    expect(run(parsed, instruction)).toEqual([
      { altAddress: "ALT", entryIndex: 2 },
    ]);
  });

  it("emits nothing when no account is ALT-supplied", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      displayFields: [{ value: accountPath(0) }],
    };
    expect(run(parsed, instructionOf([addr("static", true)]))).toEqual([]);
  });

  it("ignores out-of-range references", () => {
    const parsed: ParsedInstruction = {
      ...emptyParsed(),
      valueFlowPorts: [
        {
          accountIndices: [],
          optionalAccountStrategy: OptionalAccountStrategy.PROGRAM_ID,
          tokenValue: { kind: TokenKind.RESOLVE },
        },
      ],
      accountResets: [{ accountIndex: 9, requirePreBalanceZero: false }],
      displayFields: [{ value: accountPath(9) }],
    };
    expect(run(parsed, instructionOf([alt(1)]))).toEqual([]);
  });
});
