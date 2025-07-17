import {
  ContainerPath,
  type DataPathElement,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  bufferToHexaString,
  ByteArrayBuilder,
  hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";

import { TransactionParserService } from "./TransactionParserService";

describe("TransactionParserService", () => {
  const parser = new TransactionParserService();

  const TO = hexaStringToBuffer("0x3f32cF0B1DF94157EE1c3876c49BE3732C92a98f")!;
  const VALUE = 81818275935222000n;
  const VALUE_BIN = new ByteArrayBuilder()
    .add256BitUIntToData(81818275935222000n)
    .build();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Container paths", () => {
    it("should extract TO of the container", () => {
      // GIVEN
      const subset = {
        chainId: 1,
        data: "0x",
        selector: "0x",
        to: bufferToHexaString(TO),
        value: VALUE,
      };

      // WHEN
      const value = parser.extractValue(subset, ContainerPath.TO);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([TO]);
    });

    it("should extract VALUE of the container", () => {
      // GIVEN

      const subset = {
        chainId: 1,
        data: "0x",
        selector: "0x",
        to: bufferToHexaString(TO),
        value: VALUE,
      };

      // WHEN
      const value = parser.extractValue(subset, ContainerPath.VALUE);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([VALUE_BIN]);
    });

    it("Unavailable container fields", () => {
      // GIVEN
      const subset = {
        chainId: 1,
        data: "0x",
        selector: "0x",
        to: undefined,
        from: undefined,
        value: VALUE,
      };

      // WHEN
      const from = parser.extractValue(subset, ContainerPath.FROM);
      const to = parser.extractValue(subset, ContainerPath.TO);

      // THEN
      expect(from.isRight()).toStrictEqual(false);
      expect(to.isRight()).toStrictEqual(false);
    });

    it("invalid transaction format", () => {
      // GIVEN
      const transaction = hexaStringToBuffer(
        "0xdeadbeef",
      ) as unknown as TransactionSubset;

      // WHEN
      const from = parser.extractValue(transaction, ContainerPath.FROM);

      // THEN
      expect(from.isRight()).toStrictEqual(false);
    });
  });

  describe("Data paths in a calldata with static elements", () => {
    // Example from abi specification:
    // https://docs.soliditylang.org/en/latest/abi-spec.html
    //
    // function baz(uint32 x, bool y)
    // parameters: x = 69
    //             y = true
    // calldata:
    //   0xcdcd77c0
    //   [0] 0x0000000000000000000000000000000000000000000000000000000000000045
    //   [1] 0x0000000000000000000000000000000000000000000000000000000000000001
    const subset = {
      chainId: 1,
      data: "0xcdcd77c000000000000000000000000000000000000000000000000000000000000000450000000000000000000000000000000000000000000000000000000000000001",
      selector: "0xcdcd77c",
      to: bufferToHexaString(TO),
      value: VALUE,
    };

    it("Extract the first element", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 0,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000045",
        )!,
      ]);
    });

    it("Extract the second element", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        )!,
      ]);
    });

    it("Slice the static leaf", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 0,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
        {
          type: "SLICE",
          start: -4,
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer("0x00000045")!,
      ]);
    });

    it("Out of bounds", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 2,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];
      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });
  });

  describe("Data paths in a calldata with dynamic elements", () => {
    // Example from abi specification:
    // https://docs.soliditylang.org/en/latest/abi-spec.html
    //
    // function g(uint256[][] x, string[] x)
    // parameters: x = [[1, 2], [3]]
    //             y = ["one", "two", "three"]
    // calldata:
    //   0x2289b18c
    //   [0] 0x0000000000000000000000000000000000000000000000000000000000000040: offset of x
    //   [1] 0x0000000000000000000000000000000000000000000000000000000000000140: offset of y
    //   [2] 0x0000000000000000000000000000000000000000000000000000000000000002: length of x
    //   [3] 0x0000000000000000000000000000000000000000000000000000000000000040: offset of x[0]
    //   [4] 0x00000000000000000000000000000000000000000000000000000000000000a0: offset of x[1]
    //   [5] 0x0000000000000000000000000000000000000000000000000000000000000002: length of x[0]
    //   [6] 0x0000000000000000000000000000000000000000000000000000000000000001: value of x[0][0] = 1
    //   [7] 0x0000000000000000000000000000000000000000000000000000000000000002: value of x[0][1] = 2
    //   [8] 0x0000000000000000000000000000000000000000000000000000000000000001: length of x[1]
    //   [9] 0x0000000000000000000000000000000000000000000000000000000000000003: value of x[1][0] = 3
    //   [10] 0x0000000000000000000000000000000000000000000000000000000000000003: length of y
    //   [11] 0x0000000000000000000000000000000000000000000000000000000000000060: offset of y[0]
    //   [12] 0x00000000000000000000000000000000000000000000000000000000000000a0: offset of y[1]
    //   [13] 0x00000000000000000000000000000000000000000000000000000000000000e0: offset of y[2]
    //   [14] 0x0000000000000000000000000000000000000000000000000000000000000003: length of y[0]
    //   [15] 0x6f6e650000000000000000000000000000000000000000000000000000000000: value of y[0] = "one"
    //   [16] 0x0000000000000000000000000000000000000000000000000000000000000003: length of y[1]
    //   [17] 0x74776f0000000000000000000000000000000000000000000000000000000000: value of y[1] = "two"
    //   [18] 0x0000000000000000000000000000000000000000000000000000000000000005: length of y[2]
    //   [19] 0x7468726565000000000000000000000000000000000000000000000000000000: value of y[2] = "three"
    const subset = {
      to: bufferToHexaString(TO),
      value: VALUE,
      chainId: 1,
      data: "0x2289b18c000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000001400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000000036f6e650000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000374776f000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000057468726565000000000000000000000000000000000000000000000000000000",
      selector: "0x2289b18c",
    };
    it("Extract all the elements of x, concatenated together", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 0,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        )!,
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000002",
        )!,
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000003",
        )!,
      ]);
    });

    it("Extract all the elements of x[0]", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 0,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
          start: 0,
          end: 1,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        )!,
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000002",
        )!,
      ]);
    });

    it("Extract all the elements of x[0:-1][-1:]", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 0,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
          start: 0,
          end: -1,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
          start: -1,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000002",
        )!,
      ]);
    });

    it("Array out of bounds", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 0,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
          start: 0,
          end: 1,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
          start: 2,
          end: 3,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });

    it("Extract all the elements of x[1]", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
        },
        {
          type: "REF",
        },
        {
          type: "LEAF",
          leafType: "DYNAMIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer("0x6f6e65")!,
        hexaStringToBuffer("0x74776f")!,
        hexaStringToBuffer("0x7468726565")!,
      ]);
    });

    it("Extract all the elements of x[1][:2]", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
          end: 2,
        },
        {
          type: "REF",
        },
        {
          type: "LEAF",
          leafType: "DYNAMIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer("0x6f6e65")!,
        hexaStringToBuffer("0x74776f")!,
      ]);
    });

    it("Slice the dynamic leaf with [1:-2]", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
          start: 2,
          end: 3,
        },
        {
          type: "REF",
        },
        {
          type: "LEAF",
          leafType: "DYNAMIC_LEAF",
        },
        {
          type: "SLICE",
          start: 1,
          end: -2,
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer("0x6872")!,
      ]);
    });

    it("Slice the dynamic leaf with [-1:]", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
          start: 2,
          end: 3,
        },
        {
          type: "REF",
        },
        {
          type: "LEAF",
          leafType: "DYNAMIC_LEAF",
        },
        {
          type: "SLICE",
          start: -1,
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([hexaStringToBuffer("0x65")!]);
    });

    it("Slice the dynamic leaf with [:1]", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 1,
          start: 2,
          end: 3,
        },
        {
          type: "REF",
        },
        {
          type: "LEAF",
          leafType: "DYNAMIC_LEAF",
        },
        {
          type: "SLICE",
          end: 1,
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([hexaStringToBuffer("0x74")!]);
    });

    it("Error no leaf", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });

    it("Error slice not at the end", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "SLICE",
          start: 0,
          end: 1,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });

    it("Error empty slice", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "LEAF",
          leafType: "DYNAMIC_LEAF",
        },
        {
          type: "SLICE",
          start: 0,
          end: 0,
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });
  });

  describe("Array of tuples, with bigger itemSize", () => {
    // Example constructed with an array of tuples just for the tests
    //
    // function baz((uint32, uint32) myTuple[])
    // parameters: myTuple = [ (1, 2), (3, 4), (5, 6) ]
    // calldata:
    //   0xcdcd77c0
    //   [0] 0x0000000000000000000000000000000000000000000000000000000000000020
    //   [1] 0x0000000000000000000000000000000000000000000000000000000000000003
    //   [2] 0x0000000000000000000000000000000000000000000000000000000000000001
    //   [3] 0x0000000000000000000000000000000000000000000000000000000000000002
    //   [4] 0x0000000000000000000000000000000000000000000000000000000000000003
    //   [5] 0x0000000000000000000000000000000000000000000000000000000000000004
    //   [6] 0x0000000000000000000000000000000000000000000000000000000000000005
    //   [7] 0x0000000000000000000000000000000000000000000000000000000000000006
    const subset = {
      chainId: 1,
      data: "0xcdcd77c000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000003000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000000006",
      selector: "0xcdcd77c",
      to: bufferToHexaString(TO),
      value: VALUE,
    };

    it("Extract the first tuple element of all array elements", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 2,
        },
        {
          type: "TUPLE",
          offset: 0,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        )!,
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000003",
        )!,
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000005",
        )!,
      ]);
    });

    it("Extract the second tuple element of all array elements", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "REF",
        },
        {
          type: "ARRAY",
          itemSize: 2,
        },
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(true);
      expect(value.unsafeCoerce()).toStrictEqual([
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000002",
        )!,
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000004",
        )!,
        hexaStringToBuffer(
          "0x0000000000000000000000000000000000000000000000000000000000000006",
        )!,
      ]);
    });
  });

  describe("Malformed calldata", () => {
    // Example constructed with invalid data just for the tests
    //
    // calldata:
    //   0x2289b18c
    //   [0] 0x0000000000000000000000000000000000000000000000000000000000000080
    //   [1] 0xf000000000000000000000000000000000000000000000000000000000000140
    //   [2] 0xf000000000000000000000000000000000000000000000000000000000000002
    const subset = {
      chainId: 1,
      data: "0x2289b18c0000000000000000000000000000000000000000000000000000000000000080f000000000000000000000000000000000000000000000000000000000000140f000000000000000000000000000000000000000000000000000000000000002",
      selector: "0x2289b18c",
      to: bufferToHexaString(TO),
      value: VALUE,
    };

    it("Dynamic leaf length overflow", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "LEAF",
          leafType: "DYNAMIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });

    it("Calldata smaller than dynamic leaf", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 0,
        },
        {
          type: "LEAF",
          leafType: "DYNAMIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });

    it("Array length overflow", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "ARRAY",
          itemSize: 1,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });

    it("Calldata smaller than array length", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 0,
        },
        {
          type: "ARRAY",
          itemSize: 1,
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });

    it("Ref out of bounds", () => {
      // GIVEN
      const path: DataPathElement[] = [
        {
          type: "TUPLE",
          offset: 1,
        },
        {
          type: "REF",
        },
        {
          type: "LEAF",
          leafType: "STATIC_LEAF",
        },
      ];

      // WHEN
      const value = parser.extractValue(subset, path);

      // THEN
      expect(value.isRight()).toStrictEqual(false);
    });
  });
});
