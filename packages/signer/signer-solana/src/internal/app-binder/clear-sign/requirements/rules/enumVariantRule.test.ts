import { Left, Right } from "purify-ts";

import { type SelectedEnumVariant } from "@internal/app-binder/clear-sign/idl-type-pool";
import { type MatchedInstruction } from "@internal/app-binder/clear-sign/requirements/model";
import { RequirementAccumulator } from "@internal/app-binder/clear-sign/requirements/RequirementAccumulator";
import { RequirementsDecodeError } from "@internal/app-binder/clear-sign/requirements/RequirementsError";

import {
  applyEnumVariantRule,
  type EnumVariantSelector,
} from "./enumVariantRule";

const matched: MatchedInstruction = {
  instruction: { programId: "P", accounts: [], data: Uint8Array.of(1, 2) },
  descriptor: {
    discriminator: "00",
    instructionInfo: new Uint8Array(),
    substructures: [],
    enumCache: new Map(),
  },
};

describe("applyEnumVariantRule", () => {
  it("records each selected variant keyed by the instruction's programId", () => {
    const selector: EnumVariantSelector = () =>
      Right([
        { enumId: "swap", variantIndex: 46 },
        { enumId: "swap", variantIndex: 46 },
      ] as SelectedEnumVariant[]);
    const accumulator = new RequirementAccumulator();

    const result = applyEnumVariantRule(
      matched,
      accumulator,
      selector,
      new Uint8Array(),
      0,
    );

    expect(result.isRight()).toBe(true);
    expect(accumulator.build().enumVariants).toEqual([
      { programId: "P", enumId: "swap", variantIndex: 46 },
    ]);
  });

  it("forwards the type pool, root type, cache and data to the selector", () => {
    const calls: unknown[] = [];
    const selector: EnumVariantSelector = (typePool, rootType, cache, data) => {
      calls.push({ typePool, rootType, cache, data });
      return Right([]);
    };
    applyEnumVariantRule(
      matched,
      new RequirementAccumulator(),
      selector,
      Uint8Array.of(9),
      3,
    );
    expect(calls).toEqual([
      {
        typePool: Uint8Array.of(9),
        rootType: 3,
        cache: matched.descriptor.enumCache,
        data: matched.instruction.data,
      },
    ]);
  });

  it("maps a decoder failure to a typed Left", () => {
    const selector: EnumVariantSelector = () =>
      Left({ originalError: new Error("bad pool") });
    const result = applyEnumVariantRule(
      matched,
      new RequirementAccumulator(),
      selector,
      new Uint8Array(),
      0,
    );
    expect(result.isLeft()).toBe(true);
    result.ifLeft((error) =>
      expect(error).toBeInstanceOf(RequirementsDecodeError),
    );
  });
});
