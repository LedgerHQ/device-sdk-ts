import { type RequirementInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import {
  PARAM_TYPE_ACCOUNT,
  PARAM_TYPE_TRUSTED_NAME,
  type ParsedDisplayField,
  type ParsedInstruction,
  ValueSource,
} from "@internal/app-binder/clear-sign/requirements/records";
import { RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import { DefaultBs58Encoder } from "@internal/app-binder/services/bs58Encoder";

import { applyTrustedNameRule } from "./trustedNameRule";

function run(
  displayFields: ParsedDisplayField[],
  addresses: (string | undefined)[],
) {
  const parsed: ParsedInstruction = {
    info: { typePool: [], rootType: 0, mintAssociations: [] },
    valueFlowPorts: [],
    accountResets: [],
    displayFields,
  };
  const instruction: RequirementInstruction = {
    programId: "P",
    accounts: addresses.map((address) => ({ address })),
    data: new Uint8Array(),
  };
  const accumulator = new RequirementAccumulator();
  applyTrustedNameRule(parsed, instruction, accumulator);
  return accumulator.build().trustedNames;
}

describe("applyTrustedNameRule", () => {
  it("resolves an ACCOUNT_PATH trusted-name target", () => {
    const result = run(
      [
        {
          paramType: PARAM_TYPE_TRUSTED_NAME,
          value: {
            source: ValueSource.ACCOUNT_PATH,
            payload: Uint8Array.of(1),
          },
        },
      ],
      ["ignored", "named"],
    );
    expect(result).toEqual(["named"]);
  });

  it("encodes a 32-byte CONSTANT trusted-name target", () => {
    const addr = new Uint8Array(32).fill(8);
    const result = run(
      [
        {
          paramType: PARAM_TYPE_TRUSTED_NAME,
          value: { source: ValueSource.CONSTANT, payload: addr },
        },
      ],
      [],
    );
    expect(result).toEqual([DefaultBs58Encoder.encode(addr)]);
  });

  it("resolves an ACCOUNT display field target (best-effort CAL name)", () => {
    const result = run(
      [
        {
          paramType: PARAM_TYPE_ACCOUNT,
          value: {
            source: ValueSource.ACCOUNT_PATH,
            payload: Uint8Array.of(0),
          },
        },
      ],
      ["account"],
    );
    expect(result).toEqual(["account"]);
  });

  it("deduplicates an address referenced by ACCOUNT and TRUSTED_NAME fields", () => {
    const result = run(
      [
        {
          paramType: PARAM_TYPE_ACCOUNT,
          value: {
            source: ValueSource.ACCOUNT_PATH,
            payload: Uint8Array.of(0),
          },
        },
        {
          paramType: PARAM_TYPE_TRUSTED_NAME,
          value: {
            source: ValueSource.ACCOUNT_PATH,
            payload: Uint8Array.of(0),
          },
        },
      ],
      ["shared"],
    );
    expect(result).toEqual(["shared"]);
  });

  it("ignores non-trusted-name fields and unresolved account targets", () => {
    const nonTrusted = run(
      [
        {
          paramType: 0x02,
          value: {
            source: ValueSource.ACCOUNT_PATH,
            payload: Uint8Array.of(0),
          },
        },
      ],
      ["a"],
    );
    expect(nonTrusted).toEqual([]);

    const unresolved = run(
      [
        {
          paramType: PARAM_TYPE_TRUSTED_NAME,
          value: {
            source: ValueSource.ACCOUNT_PATH,
            payload: Uint8Array.of(0),
          },
        },
      ],
      [undefined],
    );
    expect(unresolved).toEqual([]);
  });
});
