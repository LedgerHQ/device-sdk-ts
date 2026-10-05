import { describe, expect, it } from "vitest";

import type { TypedDataSchema } from "@/modules/ethereum/model/TypedDataContext";
import type { TypedDataPathElement } from "@/modules/ethereum/typed-data/data/TypedDataDescriptorDataSource";

import { resolveTypedDataPath } from "./resolveTypedDataPath";

describe("resolveTypedDataPath", () => {
  const SCHEMA: TypedDataSchema = {
    Order: [
      { name: "maker", type: "address" },
      { name: "outputs", type: "Output[]" },
    ],
    Output: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  };
  const MESSAGE = {
    maker: "0xmaker",
    outputs: [
      { token: "0xtoken0", amount: "1" },
      { token: "0xtoken1", amount: "2" },
      { token: "0xtoken2", amount: "3" },
    ],
  };
  const field = (index: number): TypedDataPathElement => ({
    type: "struct_field",
    index,
  });
  const slice = (start?: number, end?: number): TypedDataPathElement => ({
    type: "array_slice",
    start,
    end,
  });

  it("resolves a struct field", () => {
    expect(resolveTypedDataPath(SCHEMA, "Order", MESSAGE, [field(0)])).toEqual([
      "0xmaker",
    ]);
  });

  it("resolves every element of a wildcard slice", () => {
    expect(
      resolveTypedDataPath(SCHEMA, "Order", MESSAGE, [
        field(1),
        slice(),
        field(0),
      ]),
    ).toEqual(["0xtoken0", "0xtoken1", "0xtoken2"]);
  });

  it("resolves a bounded slice", () => {
    expect(
      resolveTypedDataPath(SCHEMA, "Order", MESSAGE, [
        field(1),
        slice(1, 2),
        field(0),
      ]),
    ).toEqual(["0xtoken1"]);
  });

  it("counts negative slice bounds from the end of the array", () => {
    expect(
      resolveTypedDataPath(SCHEMA, "Order", MESSAGE, [
        field(1),
        slice(-1),
        field(1),
      ]),
    ).toEqual(["3"]);
  });

  it.each([
    ["an end beyond the array", slice(0, 4)],
    ["a start before the array", slice(-4)],
    ["an empty range", slice(2, 2)],
  ])("matches nothing on %s", (_, element) => {
    expect(
      resolveTypedDataPath(SCHEMA, "Order", MESSAGE, [field(1), element]),
    ).toEqual([]);
  });

  it("matches nothing in an empty array", () => {
    expect(
      resolveTypedDataPath(SCHEMA, "Order", { maker: "0x", outputs: [] }, [
        field(1),
        slice(),
        field(0),
      ]),
    ).toEqual([]);
  });

  it("matches nothing when the path does not fit the schema", () => {
    expect(
      resolveTypedDataPath(SCHEMA, "Order", MESSAGE, [field(0), slice()]),
    ).toEqual([]);
    expect(
      resolveTypedDataPath(SCHEMA, "Order", MESSAGE, [field(0), field(0)]),
    ).toEqual([]);
    expect(resolveTypedDataPath(SCHEMA, "Order", MESSAGE, [field(5)])).toEqual(
      [],
    );
  });
});
