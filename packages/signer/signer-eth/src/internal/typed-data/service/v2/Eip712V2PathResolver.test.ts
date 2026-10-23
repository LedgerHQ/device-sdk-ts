import { type Eip712Path } from "@ledgerhq/context-module";
import { bufferToHexaString } from "@ledgerhq/device-management-kit";

import { type TypedData } from "@api/model/TypedData";
import { DefaultTypedDataParserService } from "@internal/typed-data/service/DefaultTypedDataParserService";

import { resolveEip712V2Path } from "./Eip712V2PathResolver";

// A UniswapX-like order: an input token, then an array of outputs, each with a token
const ORDER: TypedData = {
  domain: {
    name: "Permit2",
    chainId: 1,
    verifyingContract: "0x000000000022d473030f116ddee9f6b43ac78ba3",
  },
  primaryType: "Order",
  types: {
    EIP712Domain: [
      { name: "name", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
    ],
    Order: [
      { name: "inputToken", type: "address" },
      { name: "outputs", type: "Output[]" },
      { name: "data", type: "bytes" },
      { name: "grid", type: "uint8[2][]" },
    ],
    Output: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
  },
  message: {
    inputToken: "0x1111111111111111111111111111111111111111",
    outputs: [
      { token: "0x2222222222222222222222222222222222222222", amount: "1" },
      { token: "0x3333333333333333333333333333333333333333", amount: "256" },
      { token: "0x4444444444444444444444444444444444444444", amount: "0" },
    ],
    data: "0x0102030405",
    grid: [
      [1, 2],
      [3, 4],
    ],
  },
};

const INPUT_TOKEN = 0;
const OUTPUTS = 1;
const DATA = 2;
const GRID = 3;
const TOKEN = 0;
const AMOUNT = 1;

describe("resolveEip712V2Path", () => {
  const { types } = new DefaultTypedDataParserService()
    .parse(ORDER)
    .unsafeCoerce();

  const resolve = (path: Eip712Path) =>
    resolveEip712V2Path(types, ORDER.primaryType, ORDER.message, path).map(
      (values) => values.map((value) => bufferToHexaString(value)),
    );

  it("should resolve a field of the root struct", () => {
    expect(
      resolve([{ type: "STRUCT_FIELD", index: INPUT_TOKEN }]).extract(),
    ).toStrictEqual(["0x1111111111111111111111111111111111111111"]);
  });

  it("should resolve a field of every element of an array", () => {
    expect(
      resolve([
        { type: "STRUCT_FIELD", index: OUTPUTS },
        { type: "ARRAY_SLICE" },
        { type: "STRUCT_FIELD", index: TOKEN },
      ]).extract(),
    ).toStrictEqual([
      "0x2222222222222222222222222222222222222222",
      "0x3333333333333333333333333333333333333333",
      "0x4444444444444444444444444444444444444444",
    ]);
  });

  it("should resolve the leaves in their minimal encoding", () => {
    expect(
      resolve([
        { type: "STRUCT_FIELD", index: OUTPUTS },
        { type: "ARRAY_SLICE" },
        { type: "STRUCT_FIELD", index: AMOUNT },
      ]).extract(),
    ).toStrictEqual(["0x01", "0x0100", "0x00"]);
  });

  it.each([
    ["a range", 1, 3, ["0x33", "0x44"]],
    ["a negative start", -1, undefined, ["0x44"]],
    ["a negative end", undefined, -2, ["0x22"]],
    ["an inverted range", 2, 1, []],
    ["a start past the array", 3, undefined, []],
  ])("should resolve %s of an array", (_, start, end, expected) => {
    expect(
      resolve([
        { type: "STRUCT_FIELD", index: OUTPUTS },
        { type: "ARRAY_SLICE", start, end },
        { type: "STRUCT_FIELD", index: TOKEN },
        { type: "LEAF_SLICE", end: 1 },
      ]).extract(),
    ).toStrictEqual(expected);
  });

  it("should open every dimension of a nested array, outermost first", () => {
    expect(
      resolve([
        { type: "STRUCT_FIELD", index: GRID },
        { type: "ARRAY_SLICE", start: 1 },
        { type: "ARRAY_SLICE", start: 0, end: 1 },
      ]).extract(),
    ).toStrictEqual(["0x03"]);
  });

  it("should keep the bytes of the leaf a leaf slice selects", () => {
    expect(
      resolve([
        { type: "STRUCT_FIELD", index: DATA },
        { type: "LEAF_SLICE", start: 1, end: -1 },
      ]).extract(),
    ).toStrictEqual(["0x020304"]);
  });

  it.each([
    ["a field the struct does not have", [{ type: "STRUCT_FIELD", index: 9 }]],
    ["a slice of a struct", [{ type: "ARRAY_SLICE" }]],
    [
      "a field of an array",
      [
        { type: "STRUCT_FIELD", index: OUTPUTS },
        { type: "STRUCT_FIELD", index: TOKEN },
      ],
    ],
    ["a path ending on an array", [{ type: "STRUCT_FIELD", index: OUTPUTS }]],
    [
      "a path ending on a struct",
      [{ type: "STRUCT_FIELD", index: OUTPUTS }, { type: "ARRAY_SLICE" }],
    ],
    [
      "a path ending inside a nested array",
      [{ type: "STRUCT_FIELD", index: GRID }, { type: "ARRAY_SLICE" }],
    ],
    [
      "a slice ending past the array",
      [
        { type: "STRUCT_FIELD", index: OUTPUTS },
        { type: "ARRAY_SLICE", end: 4 },
        { type: "STRUCT_FIELD", index: TOKEN },
      ],
    ],
    [
      "a slice starting before the array",
      [
        { type: "STRUCT_FIELD", index: OUTPUTS },
        { type: "ARRAY_SLICE", start: -4 },
        { type: "STRUCT_FIELD", index: TOKEN },
      ],
    ],
    [
      "a leaf slice keeping no byte",
      [
        { type: "STRUCT_FIELD", index: DATA },
        { type: "LEAF_SLICE", start: 2, end: 2 },
      ],
    ],
  ] as [string, Eip712Path][])("should refuse %s", (_, path) => {
    expect(resolve(path).isLeft()).toBe(true);
  });

  it("should not check the steps after an empty selection", () => {
    expect(
      resolve([
        { type: "STRUCT_FIELD", index: OUTPUTS },
        { type: "ARRAY_SLICE", start: 3 },
        { type: "STRUCT_FIELD", index: 9 },
      ]).extract(),
    ).toStrictEqual([]);
  });
});
