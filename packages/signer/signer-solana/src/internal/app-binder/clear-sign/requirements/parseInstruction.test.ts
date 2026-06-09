import {
  accountReset,
  bytes,
  instructionInfo,
  tokenValue,
  trustedNameDisplayField,
  value,
  valueFlowPort,
} from "./__tests__/fixtures/tlvBuilders";
import { type InstructionDescriptor, SubstructureKind } from "./model";
import { parseInstructionDescriptor } from "./parseInstruction";
import { TokenKind } from "./records";

function descriptor(
  substructures: { kind: SubstructureKind; data: Uint8Array }[],
): InstructionDescriptor {
  return {
    discriminator: "00",
    instructionInfo: instructionInfo({ typePool: bytes(0x00), rootType: 0 }),
    substructures,
    enumCache: new Map(),
  };
}

describe("parseInstructionDescriptor", () => {
  it("groups substructures by kind", () => {
    const parsed = parseInstructionDescriptor(
      descriptor([
        {
          kind: SubstructureKind.VALUE_FLOW_PORT,
          data: valueFlowPort({
            accountIndex: 0,
            tokenValue: tokenValue(TokenKind.NATIVE),
          }),
        },
        {
          kind: SubstructureKind.ACCOUNT_RESET,
          data: accountReset({ accountIndex: 1, requirePreBalanceZero: true }),
        },
        {
          kind: SubstructureKind.DISPLAY_FIELD,
          data: trustedNameDisplayField(value(0x01, bytes(2))),
        },
      ]),
    );
    expect(parsed.valueFlowPorts).toHaveLength(1);
    expect(parsed.accountResets).toHaveLength(1);
    expect(parsed.displayFields).toHaveLength(1);
  });

  it("ignores HIDE_RULE substructures (out of scope here)", () => {
    const parsed = parseInstructionDescriptor(
      descriptor([
        { kind: SubstructureKind.HIDE_RULE, data: bytes(0x01, 0x01, 0x00) },
      ]),
    );
    expect(parsed.valueFlowPorts).toEqual([]);
    expect(parsed.accountResets).toEqual([]);
    expect(parsed.displayFields).toEqual([]);
  });

  it("keeps multiple substructures of the same kind in order", () => {
    const parsed = parseInstructionDescriptor(
      descriptor([
        {
          kind: SubstructureKind.VALUE_FLOW_PORT,
          data: valueFlowPort({ accountIndex: 0 }),
        },
        {
          kind: SubstructureKind.VALUE_FLOW_PORT,
          data: valueFlowPort({ accountIndex: 1 }),
        },
      ]),
    );
    expect(parsed.valueFlowPorts.map((port) => port.accountIndices)).toEqual([
      [0],
      [1],
    ]);
  });
});
