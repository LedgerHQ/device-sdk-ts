import { Just, Nothing } from "purify-ts";

import { PrimitiveType } from "@internal/typed-data/model/Types";

import { encodeTypedDataValue } from "./TypedDataEncoder";

describe("TypedDataEncoder", () => {
  const ADDRESS_TYPE = new PrimitiveType("address", "address", Nothing);
  const BYTES_TYPE = new PrimitiveType("bytes", "bytes", Nothing);
  const BYTES_TYPE_WITH_LENGTH = new PrimitiveType("bytes", "bytes", Just(7));
  const STRING_TYPE = new PrimitiveType("string", "string", Nothing);
  const BOOL_TYPE = new PrimitiveType("bool", "bool", Nothing);
  const I8_TYPE = new PrimitiveType("int8", "int", Just(1));
  const I16_TYPE = new PrimitiveType("int16", "int", Just(2));
  const I32_TYPE = new PrimitiveType("int32", "int", Just(4));
  const I64_TYPE = new PrimitiveType("int64", "int", Just(8));
  const I128_TYPE = new PrimitiveType("int128", "int", Just(16));
  const I256_TYPE = new PrimitiveType("int256", "int", Just(32));
  const U8_TYPE = new PrimitiveType("uint8", "uint", Just(1));
  const U16_TYPE = new PrimitiveType("uint16", "uint", Just(2));
  const U32_TYPE = new PrimitiveType("uint32", "uint", Just(4));
  const U64_TYPE = new PrimitiveType("uint64", "uint", Just(8));
  const U128_TYPE = new PrimitiveType("uint128", "uint", Just(16));
  const U256_TYPE = new PrimitiveType("uint256", "uint", Just(32));

  it("Encode an address", () => {
    // GIVEN
    const addresses = [
      "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826",
      "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF",
      "0xB0BdaBea57B0BDABeA57b0bdABEA57b0BDabEa57",
      "0xBdaBea57B0BDABeA57b0bdABEA57b0BDabEa57",
    ];
    // WHEN
    const encoded = addresses.map((address) =>
      encodeTypedDataValue(ADDRESS_TYPE, address),
    );
    // THEN
    const expected = [
      Just(
        Uint8Array.from([
          0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc,
          0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc,
        ]),
      ),
      Just(
        Uint8Array.from([
          0xcd, 0x2a, 0x3d, 0x9f, 0x93, 0x8e, 0x13, 0xcd, 0x94, 0x7e, 0xc0,
          0x5a, 0xbc, 0x7f, 0xe7, 0x34, 0xdf, 0x8d, 0xd8, 0x26,
        ]),
      ),
      Just(
        Uint8Array.from([
          0xde, 0xad, 0xbe, 0xef, 0xde, 0xad, 0xbe, 0xef, 0xde, 0xad, 0xbe,
          0xef, 0xde, 0xad, 0xbe, 0xef, 0xde, 0xad, 0xbe, 0xef,
        ]),
      ),
      Just(
        Uint8Array.from([
          0xb0, 0xbd, 0xab, 0xea, 0x57, 0xb0, 0xbd, 0xab, 0xea, 0x57, 0xb0,
          0xbd, 0xab, 0xea, 0x57, 0xb0, 0xbd, 0xab, 0xea, 0x57,
        ]),
      ),
      Just(
        Uint8Array.from([
          0xbd, 0xab, 0xea, 0x57, 0xb0, 0xbd, 0xab, 0xea, 0x57, 0xb0, 0xbd,
          0xab, 0xea, 0x57, 0xb0, 0xbd, 0xab, 0xea, 0x57,
        ]),
      ),
    ];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode an address with invalid size", () => {
    // GIVEN
    const address = "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccCff";
    // WHEN
    const encoded = encodeTypedDataValue(ADDRESS_TYPE, address);
    // THEN
    expect(encoded).toStrictEqual(Nothing);
  });

  it("Encode an address with invalid value", () => {
    // GIVEN
    const address = "0xbonjourcCCCCcCCCCCCcCcCccCcCCCcCcccccccC";
    // WHEN
    const encoded = encodeTypedDataValue(ADDRESS_TYPE, address);
    // THEN
    expect(encoded).toStrictEqual(Nothing);
  });

  it("Encode an address with invalid value type", () => {
    // GIVEN
    const address = 17;
    // WHEN
    const encoded = encodeTypedDataValue(ADDRESS_TYPE, address);
    // THEN
    expect(encoded).toStrictEqual(Nothing);
  });

  it("Encode an byte array", () => {
    // GIVEN
    const bytes = [
      "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcc",
      "0x13CD947Ec05AbC7FE734Df8DD826",
      "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeFbeeF",
      "0xBDabEa57",
    ];
    // WHEN
    const encoded = bytes.map((b) => encodeTypedDataValue(BYTES_TYPE, b));
    // THEN
    const expected = [
      Just(
        Uint8Array.from([
          0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc,
          0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc,
        ]),
      ),
      Just(
        Uint8Array.from([
          0x13, 0xcd, 0x94, 0x7e, 0xc0, 0x5a, 0xbc, 0x7f, 0xe7, 0x34, 0xdf,
          0x8d, 0xd8, 0x26,
        ]),
      ),
      Just(
        Uint8Array.from([
          0xde, 0xad, 0xbe, 0xef, 0xde, 0xad, 0xbe, 0xef, 0xde, 0xad, 0xbe,
          0xef, 0xde, 0xad, 0xbe, 0xef, 0xde, 0xad, 0xbe, 0xef, 0xbe, 0xef,
        ]),
      ),
      Just(Uint8Array.from([0xbd, 0xab, 0xea, 0x57])),
    ];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode an byte array with size", () => {
    // GIVEN
    const bytes = ["0x13CD947Ec05AbC", "0x13CD947Ec05A", "0x13CD947Ec05AbCde"];
    // WHEN
    const encoded = bytes.map((b) =>
      encodeTypedDataValue(BYTES_TYPE_WITH_LENGTH, b),
    );
    // THEN
    const expected = [
      Just(Uint8Array.from([0x13, 0xcd, 0x94, 0x7e, 0xc0, 0x5a, 0xbc])),
      Just(Uint8Array.from([0x13, 0xcd, 0x94, 0x7e, 0xc0, 0x5a])),
      Nothing,
    ];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode a string", () => {
    // GIVEN
    const strings = [
      "Hello, Bob!",
      '"did:ethr:0xf7398bacf610bb4e3b567811279fcb3c41919f89"',
      '"2021-03-04T21:08:22.615Z"^^<http://www.w3.org/2001/XMLSchema#dateTime>',
      "_<did:key:z6MkgFneaaMjN6zybqLNXgt4YfmVx2XZhzPdDyk4ZK81daHZ>",
    ];
    // WHEN
    const encoded = strings.map((str) =>
      encodeTypedDataValue(STRING_TYPE, str),
    );
    // THEN
    const expected = [
      Just(
        Uint8Array.from([
          0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x42, 0x6f, 0x62, 0x21,
        ]),
      ),
      Just(
        Uint8Array.from([
          0x22, 0x64, 0x69, 0x64, 0x3a, 0x65, 0x74, 0x68, 0x72, 0x3a, 0x30,
          0x78, 0x66, 0x37, 0x33, 0x39, 0x38, 0x62, 0x61, 0x63, 0x66, 0x36,
          0x31, 0x30, 0x62, 0x62, 0x34, 0x65, 0x33, 0x62, 0x35, 0x36, 0x37,
          0x38, 0x31, 0x31, 0x32, 0x37, 0x39, 0x66, 0x63, 0x62, 0x33, 0x63,
          0x34, 0x31, 0x39, 0x31, 0x39, 0x66, 0x38, 0x39, 0x22,
        ]),
      ),
      Just(
        Uint8Array.from([
          0x22, 0x32, 0x30, 0x32, 0x31, 0x2d, 0x30, 0x33, 0x2d, 0x30, 0x34,
          0x54, 0x32, 0x31, 0x3a, 0x30, 0x38, 0x3a, 0x32, 0x32, 0x2e, 0x36,
          0x31, 0x35, 0x5a, 0x22, 0x5e, 0x5e, 0x3c, 0x68, 0x74, 0x74, 0x70,
          0x3a, 0x2f, 0x2f, 0x77, 0x77, 0x77, 0x2e, 0x77, 0x33, 0x2e, 0x6f,
          0x72, 0x67, 0x2f, 0x32, 0x30, 0x30, 0x31, 0x2f, 0x58, 0x4d, 0x4c,
          0x53, 0x63, 0x68, 0x65, 0x6d, 0x61, 0x23, 0x64, 0x61, 0x74, 0x65,
          0x54, 0x69, 0x6d, 0x65, 0x3e,
        ]),
      ),
      Just(
        Uint8Array.from([
          0x5f, 0x3c, 0x64, 0x69, 0x64, 0x3a, 0x6b, 0x65, 0x79, 0x3a, 0x7a,
          0x36, 0x4d, 0x6b, 0x67, 0x46, 0x6e, 0x65, 0x61, 0x61, 0x4d, 0x6a,
          0x4e, 0x36, 0x7a, 0x79, 0x62, 0x71, 0x4c, 0x4e, 0x58, 0x67, 0x74,
          0x34, 0x59, 0x66, 0x6d, 0x56, 0x78, 0x32, 0x58, 0x5a, 0x68, 0x7a,
          0x50, 0x64, 0x44, 0x79, 0x6b, 0x34, 0x5a, 0x4b, 0x38, 0x31, 0x64,
          0x61, 0x48, 0x5a, 0x3e,
        ]),
      ),
    ];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode a string with invalid value type", () => {
    // GIVEN
    const string = 17;
    // WHEN
    const encoded = encodeTypedDataValue(STRING_TYPE, string);
    // THEN
    expect(encoded).toStrictEqual(Nothing);
  });

  it("Encode a signed number", () => {
    // GIVEN
    const signed = [
      { type: I8_TYPE, value: 127 },
      { type: I8_TYPE, value: -128 },
      { type: I16_TYPE, value: "32767" },
      { type: I16_TYPE, value: "-32768" },
      { type: I32_TYPE, value: "0x7FFFFFFF" },
      { type: I32_TYPE, value: "-2147483648" },
      { type: I64_TYPE, value: 9223372036854775807n },
      { type: I64_TYPE, value: -9223372036854775808n },
      { type: I128_TYPE, value: "170141183460469231731687303715884105727" },
      { type: I128_TYPE, value: "-170141183460469231731687303715884105728" },
      {
        type: I256_TYPE,
        value:
          57896044618658097711785492504343953926634992332820282019728792003956564819967n,
      },
      {
        type: I256_TYPE,
        value:
          -57896044618658097711785492504343953926634992332820282019728792003956564819968n,
      },
    ];
    // WHEN
    const encoded = signed.map((s) => encodeTypedDataValue(s.type, s.value));
    // THEN
    const expected = [
      Just(Uint8Array.from([0x7f])),
      Just(Uint8Array.from([0x80])),
      Just(Uint8Array.from([0x7f, 0xff])),
      Just(Uint8Array.from([0x80, 0x00])),
      Just(Uint8Array.from([0x7f, 0xff, 0xff, 0xff])),
      Just(Uint8Array.from([0x80, 0x00, 0x00, 0x00])),
      Just(Uint8Array.from([0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])),
      Just(Uint8Array.from([0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])),
      Just(
        Uint8Array.from([
          0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff,
        ]),
      ),
      Just(
        Uint8Array.from([
          0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00,
        ]),
      ),
      Just(
        Uint8Array.from([
          0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        ]),
      ),
      Just(
        Uint8Array.from([
          0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        ]),
      ),
    ];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode a signed number, out of bounds", () => {
    // GIVEN
    const signed = [
      { type: I8_TYPE, value: "" },
      { type: I8_TYPE, value: 128 },
      { type: I8_TYPE, value: -129 },
      { type: I16_TYPE, value: "32768" },
      { type: I16_TYPE, value: "-32769" },
      { type: I32_TYPE, value: "0xFFFFFFFF" },
      { type: I32_TYPE, value: "-2147483649" },
      { type: I64_TYPE, value: 9223372036854775808n },
      { type: I64_TYPE, value: -9223372036854775809n },
      { type: I128_TYPE, value: "170141183460469231731687303715884105728" },
      { type: I128_TYPE, value: "-170141183460469231731687303715884105729" },
      {
        type: I256_TYPE,
        value:
          57896044618658097711785492504343953926634992332820282019728792003956564819968n,
      },
      {
        type: I256_TYPE,
        value:
          -57896044618658097711785492504343953926634992332820282019728792003956564819969n,
      },
    ];
    // WHEN
    const encoded = signed.map((s) => encodeTypedDataValue(s.type, s.value));
    // THEN
    const expected = [
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
    ];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode an unsigned number", () => {
    // GIVEN
    const unsigned = [
      { type: U8_TYPE, value: 0 },
      { type: U8_TYPE, value: 255 },
      { type: U16_TYPE, value: "65535" },
      { type: U32_TYPE, value: "0xFFFFFFFF" },
      { type: U64_TYPE, value: 18446744073709551615n },
      { type: U128_TYPE, value: "340282366920938463463374607431768211455" },
      {
        type: U256_TYPE,
        value:
          115792089237316195423570985008687907853269984665640564039457584007913129639935n,
      },
    ];
    // WHEN
    const encoded = unsigned.map((s) => encodeTypedDataValue(s.type, s.value));
    // THEN
    const expected = [
      Just(Uint8Array.from([0x00])),
      Just(Uint8Array.from([0xff])),
      Just(Uint8Array.from([0xff, 0xff])),
      Just(Uint8Array.from([0xff, 0xff, 0xff, 0xff])),
      Just(Uint8Array.from([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])),
      Just(
        Uint8Array.from([
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff,
        ]),
      ),
      Just(
        Uint8Array.from([
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
          0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        ]),
      ),
    ];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode an unsigned number, out of bound", () => {
    // GIVEN
    const unsigned = [
      { type: U8_TYPE, value: "" },
      { type: U8_TYPE, value: 0.5 },
      { type: U8_TYPE, value: -1 },
      { type: U8_TYPE, value: 256 },
      { type: U16_TYPE, value: "65536" },
      { type: U32_TYPE, value: "0x100000000" },
      { type: U64_TYPE, value: 18446744073709551616n },
      { type: U128_TYPE, value: "340282366920938463463374607431768211456" },
      {
        type: U256_TYPE,
        value:
          115792089237316195423570985008687907853269984665640564039457584007913129639936n,
      },
    ];
    // WHEN
    const encoded = unsigned.map((s) => encodeTypedDataValue(s.type, s.value));
    // THEN
    const expected = [
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
      Nothing,
    ];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode a boolean", () => {
    // GIVEN
    const bools = [false, true, 0, 1, "0", "0x1"];
    // WHEN
    const encoded = bools.map((b) => encodeTypedDataValue(BOOL_TYPE, b));
    // THEN
    const expected = [
      Just(Uint8Array.from([0x00])),
      Just(Uint8Array.from([0x01])),
      Just(Uint8Array.from([0x00])),
      Just(Uint8Array.from([0x01])),
      Just(Uint8Array.from([0x00])),
      Just(Uint8Array.from([0x01])),
    ];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode a boolean, out of bounds", () => {
    // GIVEN
    const bools = [-1, 2];
    // WHEN
    const encoded = bools.map((b) => encodeTypedDataValue(BOOL_TYPE, b));
    // THEN
    const expected = [Nothing, Nothing];
    expect(encoded).toStrictEqual(expected);
  });

  it("Encode an invalid data type", () => {
    // GIVEN
    const data = [
      { type: U8_TYPE, value: true },
      { type: I8_TYPE, value: {} },
      { type: BOOL_TYPE, value: undefined },
      { type: STRING_TYPE, value: 42 },
      { type: BYTES_TYPE, value: 42 },
      { type: ADDRESS_TYPE, value: false },
    ];
    // WHEN
    const encoded = data.map((d) => encodeTypedDataValue(d.type, d.value));
    // THEN
    const expected = [Nothing, Nothing, Nothing, Nothing, Nothing, Nothing];
    expect(encoded).toStrictEqual(expected);
  });
});
