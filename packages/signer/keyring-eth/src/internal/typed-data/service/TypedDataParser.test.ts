import { hexaStringToBuffer } from "@ledgerhq/device-sdk-core";
import { Just, Nothing, Right } from "purify-ts";

import { TypedData } from "@api/model/TypedData";
import {
  ArrayType,
  PrimitiveType,
  StructType,
  TypedDataValueArray,
  TypedDataValueField,
  TypedDataValueRoot,
} from "@internal/typed-data/model/Types";

import { TypedDataParser } from "./TypedDataParser";

describe("TypedDataParser - types parsing", () => {
  it("Parse primitive types bytes", () => {
    // GIVEN
    const types = {
      TestStruct: [
        { name: "test1", type: "bytes" },
        { name: "test2", type: "bytes1" },
        { name: "test3", type: "bytes2" },
        { name: "test4", type: "bytes31" },
        { name: "test5", type: "bytes32" },
      ],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const expected = {
      TestStruct: {
        test1: new PrimitiveType("bytes", "bytes", Nothing),
        test2: new PrimitiveType("bytes1", "bytes", Just(1)),
        test3: new PrimitiveType("bytes2", "bytes", Just(2)),
        test4: new PrimitiveType("bytes31", "bytes", Just(31)),
        test5: new PrimitiveType("bytes32", "bytes", Just(32)),
      },
    };
    expect(parser.getStructDefinitions()).toStrictEqual(expected);
  });

  it("Parse primitive types bytes, out of bound", () => {
    // GIVEN
    const types = {
      TestStruct: [
        { name: "invalid1", type: "bytes0" },
        { name: "invalid2", type: "bytes33" },
      ],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const expected = {
      TestStruct: {
        invalid1: new StructType("bytes0"),
        invalid2: new StructType("bytes33"),
      },
    };
    expect(parser.getStructDefinitions()).toStrictEqual(expected);
  });

  it("Parse primitive types number", () => {
    // GIVEN
    const types = {
      TestStruct: [
        { name: "test1", type: "int8" },
        { name: "test2", type: "uint8" },
        { name: "test3", type: "int16" },
        { name: "test4", type: "uint32" },
        { name: "test5", type: "uint64" },
        { name: "test6", type: "int128" },
        { name: "test7", type: "int136" },
        { name: "test8", type: "int144" },
        { name: "test9", type: "uint240" },
        { name: "test10", type: "uint248" },
        { name: "test11", type: "uint256" },
        { name: "test12", type: "int256" },
      ],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const expected = {
      TestStruct: {
        test1: new PrimitiveType("int8", "int", Just(1)),
        test2: new PrimitiveType("uint8", "uint", Just(1)),
        test3: new PrimitiveType("int16", "int", Just(2)),
        test4: new PrimitiveType("uint32", "uint", Just(4)),
        test5: new PrimitiveType("uint64", "uint", Just(8)),
        test6: new PrimitiveType("int128", "int", Just(16)),
        test7: new PrimitiveType("int136", "int", Just(17)),
        test8: new PrimitiveType("int144", "int", Just(18)),
        test9: new PrimitiveType("uint240", "uint", Just(30)),
        test10: new PrimitiveType("uint248", "uint", Just(31)),
        test11: new PrimitiveType("uint256", "uint", Just(32)),
        test12: new PrimitiveType("int256", "int", Just(32)),
      },
    };
    expect(parser.getStructDefinitions()).toStrictEqual(expected);
  });

  it("Parse primitive types number, out of bound", () => {
    // GIVEN
    const types = {
      TestStruct: [
        { name: "invalid1", type: "int0" },
        { name: "invalid2", type: "uint0" },
        { name: "invalid3", type: "int7" },
        { name: "invalid4", type: "int257" },
        { name: "invalid5", type: "uint257" },
        { name: "invalid6", type: "int512" },
      ],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const expected = {
      TestStruct: {
        invalid1: new StructType("int0"),
        invalid2: new StructType("uint0"),
        invalid3: new StructType("int7"),
        invalid4: new StructType("int257"),
        invalid5: new StructType("uint257"),
        invalid6: new StructType("int512"),
      },
    };
    expect(parser.getStructDefinitions()).toStrictEqual(expected);
  });

  it("Parse primitive types others", () => {
    // GIVEN
    const types = {
      TestStruct: [
        { name: "test1", type: "address" },
        { name: "test2", type: "bool" },
        { name: "test3", type: "string" },
      ],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const expected = {
      TestStruct: {
        test1: new PrimitiveType("address", "address", Nothing),
        test2: new PrimitiveType("bool", "bool", Nothing),
        test3: new PrimitiveType("string", "string", Nothing),
      },
    };
    expect(parser.getStructDefinitions()).toStrictEqual(expected);
  });

  it("Parse arrays", () => {
    // GIVEN
    const types = {
      TestStruct: [
        { name: "test1", type: "address[]" },
        { name: "test2", type: "uint16[3]" },
        { name: "test3", type: "custom[2][][3]" },
        { name: "test4", type: "string[2][][3][]" },
      ],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const expected = {
      TestStruct: {
        test1: new ArrayType(
          "address[]",
          new PrimitiveType("address", "address", Nothing),
          "address",
          Nothing,
          [Nothing],
        ),
        test2: new ArrayType(
          "uint16[3]",
          new PrimitiveType("uint16", "uint", Just(2)),
          "uint16",
          Just(3),
          [Just(3)],
        ),
        test3: new ArrayType(
          "custom[2][][3]",
          new StructType("custom"),
          "custom[2][]",
          Just(3),
          [Just(2), Nothing, Just(3)],
        ),
        test4: new ArrayType(
          "string[2][][3][]",
          new PrimitiveType("string", "string", Nothing),
          "string[2][][3]",
          Nothing,
          [Just(2), Nothing, Just(3), Nothing],
        ),
      },
    };
    expect(parser.getStructDefinitions()).toStrictEqual(expected);
  });

  it("Parse custom struct", () => {
    // GIVEN
    const types = {
      TestStruct: [{ name: "test", type: "MyCustomStructure" }],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const expected = {
      TestStruct: {
        test: new StructType("MyCustomStructure"),
      },
    };
    expect(parser.getStructDefinitions()).toStrictEqual(expected);
  });
});

describe("TypedDataParser - message parsing", () => {
  const MESSAGE: TypedData = {
    domain: {
      chainId: 0,
      name: "Ether Mail",
      verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      version: "1",
    },
    message: {
      contents: "Hello, Bob!",
      from: {
        name: "Cow",
        wallets: [
          "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
          "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
        ],
      },
      to: [
        {
          wallets: [
            "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB",
            "0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57",
            "0xB0B0b0b0b0b0B000000000000000000000000000",
          ],
          name: "Bob",
        },
      ],
    },
    primaryType: "Mail",
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person[1]" },
        { name: "contents", type: "string" },
      ],
      Person: [
        { name: "name", type: "string" },
        { name: "wallets", type: "address[]" },
      ],
    },
  };

  it("Parse an EIP712 message", () => {
    // GIVEN
    const types = MESSAGE.types;
    const primaryType = MESSAGE.primaryType;
    const message = MESSAGE.message;
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    const expected = [
      {
        path: "",
        type: "",
        value: new TypedDataValueRoot(primaryType),
      },
      {
        path: "from.name",
        type: "string",
        value: new TypedDataValueField(new TextEncoder().encode("Cow")),
      },
      {
        path: "from.wallets",
        type: "address[]",
        value: new TypedDataValueArray(2),
      },
      {
        path: "from.wallets.[]",
        type: "address",
        value: new TypedDataValueField(
          hexaStringToBuffer("0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826")!,
        ),
      },
      {
        path: "from.wallets.[]",
        type: "address",
        value: new TypedDataValueField(
          hexaStringToBuffer("0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF")!,
        ),
      },
      { path: "to", type: "Person[1]", value: new TypedDataValueArray(1) },
      {
        path: "to.[].name",
        type: "string",
        value: new TypedDataValueField(new TextEncoder().encode("Bob")),
      },
      {
        path: "to.[].wallets",
        type: "address[]",
        value: new TypedDataValueArray(3),
      },
      {
        path: "to.[].wallets.[]",
        type: "address",
        value: new TypedDataValueField(
          hexaStringToBuffer("0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB")!,
        ),
      },
      {
        path: "to.[].wallets.[]",
        type: "address",
        value: new TypedDataValueField(
          hexaStringToBuffer("0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57")!,
        ),
      },
      {
        path: "to.[].wallets.[]",
        type: "address",
        value: new TypedDataValueField(
          hexaStringToBuffer("0xB0B0b0b0b0b0B000000000000000000000000000")!,
        ),
      },
      {
        path: "contents",
        type: "string",
        value: new TypedDataValueField(new TextEncoder().encode("Hello, Bob!")),
      },
    ];
    expect(parsed).toStrictEqual(Right(expected));
  });

  it("Parse an EIP712 domain", () => {
    // GIVEN
    const types = MESSAGE.types;
    const primaryType = "EIP712Domain";
    const message = MESSAGE.domain;
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const expected = [
      {
        path: "",
        type: "",
        value: new TypedDataValueRoot(primaryType),
      },
      {
        path: "name",
        type: "string",
        value: new TypedDataValueField(new TextEncoder().encode("Ether Mail")),
      },
      {
        path: "version",
        type: "string",
        value: new TypedDataValueField(new TextEncoder().encode("1")),
      },
      {
        path: "chainId",
        type: "uint256",
        value: new TypedDataValueField(Uint8Array.from([0])),
      },
      {
        path: "verifyingContract",
        type: "address",
        value: new TypedDataValueField(
          hexaStringToBuffer("0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC")!,
        ),
      },
    ];
    const parsed = parser.parse(primaryType, message);
    expect(parsed).toStrictEqual(Right(expected));
  });

  it("Invalid primary type", () => {
    // GIVEN
    const types = MESSAGE.types;
    const primaryType = "unknown";
    const message = MESSAGE.domain;
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });

  it("Struct points to an unknown custom type", () => {
    // GIVEN
    const types = {
      Mail: [{ name: "from", type: "Person" }],
    };
    const primaryType = "Mail";
    const message = {
      from: "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });

  it("Array contains an unknown custom type", () => {
    // GIVEN
    const types = {
      Mail: [{ name: "from", type: "Person[]" }],
    };
    const primaryType = "Mail";
    const message = {
      from: ["0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });

  it("Invalid primitive value", () => {
    // GIVEN
    const types = {
      Mail: [{ name: "from", type: "uint8" }],
    };
    const primaryType = "Mail";
    const message = {
      from: 3000,
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });

  it("Array instead of primitive value", () => {
    // GIVEN
    const types = {
      Mail: [{ name: "from", type: "uint8" }],
    };
    const primaryType = "Mail";
    const message = {
      from: [42],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });

  it("Struct instead of primitive value", () => {
    // GIVEN
    const types = {
      Mail: [{ name: "from", type: "uint8" }],
    };
    const primaryType = "Mail";
    const message = {
      from: { data: 42 },
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });

  it("Struct value not a record", () => {
    // GIVEN
    const types = {
      Mail: [{ name: "from", type: "Person" }],
      Person: [{ name: "data", type: "uint8" }],
    };
    const primaryType = "Mail";
    const message = {
      from: 42,
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });

  it("Struct field not present in value", () => {
    // GIVEN
    const types = {
      Mail: [{ name: "from", type: "uint8" }],
    };
    const primaryType = "Mail";
    const message = {
      to: 42,
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });

  it("Array value not an array", () => {
    // GIVEN
    const types = {
      Mail: [{ name: "from", type: "uint8[]" }],
    };
    const primaryType = "Mail";
    const message = {
      from: 42,
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });

  it("Array value with invalid size", () => {
    // GIVEN
    const types = {
      Mail: [{ name: "from", type: "uint8[3]" }],
    };
    const primaryType = "Mail";
    const message = {
      from: [42],
    };
    // WHEN
    const parser = new TypedDataParser(types);
    // THEN
    const parsed = parser.parse(primaryType, message);
    expect(parsed.isLeft()).toStrictEqual(true);
  });
});
