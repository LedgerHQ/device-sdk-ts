import {
  accountReset,
  constantValue,
  descriptor,
  tokenAmountDisplayField,
  tokenValue,
  trustedNameDisplayField,
  valueFlowPort,
} from "./__tests__/fixtures/calBuilders";
import { parseInstructionDescriptor } from "./parseInstruction";
import {
  PARAM_TYPE_TOKEN_AMOUNT,
  PARAM_TYPE_TRUSTED_NAME,
  TokenKind,
} from "./records";

describe("parseInstructionDescriptor", () => {
  it("maps the decoded substructures into grouped records", () => {
    const parsed = parseInstructionDescriptor(
      descriptor({
        valueFlowPorts: [
          valueFlowPort({
            accountIndex: 0,
            tokenValue: tokenValue("NATIVE"),
          }),
        ],
        accountResets: [
          accountReset({ accountIndex: 1, requirePreBalanceZero: true }),
        ],
        displayFields: [
          trustedNameDisplayField(constantValue(new Uint8Array(32).fill(2))),
        ],
      }),
    );
    expect(parsed.valueFlowPorts).toHaveLength(1);
    expect(parsed.valueFlowPorts[0]!.tokenValue?.kind).toBe(TokenKind.NATIVE);
    expect(parsed.accountResets).toEqual([
      { accountIndex: 1, requirePreBalanceZero: true },
    ]);
    expect(parsed.displayFields[0]!.paramType).toBe(PARAM_TYPE_TRUSTED_NAME);
  });

  it("keeps multiple substructures of the same kind in order", () => {
    const parsed = parseInstructionDescriptor(
      descriptor({
        valueFlowPorts: [
          valueFlowPort({ accountIndex: 0 }),
          valueFlowPort({ accountIndex: 1 }),
        ],
      }),
    );
    expect(parsed.valueFlowPorts.map((port) => port.accountIndices)).toEqual([
      [0],
      [1],
    ]);
  });

  it("maps a PARAM_TOKEN_AMOUNT display field's token reference", () => {
    const parsed = parseInstructionDescriptor(
      descriptor({
        displayFields: [
          tokenAmountDisplayField(constantValue(new Uint8Array(32).fill(3))),
        ],
      }),
    );
    const field = parsed.displayFields[0]!;
    expect(field.paramType).toBe(PARAM_TYPE_TOKEN_AMOUNT);
    expect(field.token).toBeDefined();
  });
});
