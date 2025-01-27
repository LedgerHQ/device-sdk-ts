import { hexaStringToBuffer } from "@api/utils/HexaString";

import { APDU_MAX_PAYLOAD } from "./ApduBuilder";
import { DataOverflowError, HexaStringEncodeError } from "./AppBuilderError";
import { ByteArrayBuilder } from "./ByteArrayBuilder";

const COMMAND_NO_BODY = new Uint8Array([]);

const COMMAND_BODY_SINGLE = new Uint8Array([0x01]);

const COMMAND_BODY_HEXA1 = new Uint8Array([0x80, 0x81, 0x82, 0x83, 0x84]);

const COMMAND_BODY_HEXA2 = new Uint8Array([0x85, 0x86, 0x87, 0x88]);

const COMMAND_BODY_LV_HEXA = new Uint8Array([0x03, 0xa1, 0xa2, 0xa3]);

const COMMAND_BODY_LV_ASCII = new Uint8Array([
  0x05, 0x6d, 0x61, 0x6d, 0x61, 0x6e,
]);

const COMMAND_BODY_LV_ARRAY = new Uint8Array([0x02, 0xf0, 0xf1]);

const COMMAND_BODY_COMBINED = new Uint8Array([
  0x01, 0x33, 0x02, 0x01, 0x23, 0x45, 0x67, 0x80, 0x81, 0x82, 0x83, 0x84, 0x85,
  0x86, 0x87, 0x88, 0x03, 0xa1, 0xa2, 0xa3, 0x05, 0x6d, 0x61, 0x6d, 0x61, 0x6e,
  0x02, 0xf0, 0xf1,
]);

const COMMAND_BODY_MAX = new Uint8Array([...Array<number>(255).fill(0xaa)]);

const COMMAND_BODY_NEARLY = new Uint8Array([...Array<number>(254).fill(0xaa)]);

let builder: ByteArrayBuilder;

describe("ByteArrayBuilder", () => {
  const builderAddNumber = (
    num: number | bigint,
    bigEndian: boolean,
    sizeInBits: number,
    signed: boolean,
  ) => {
    if (signed) {
      switch (sizeInBits) {
        case 2:
          builder.add16BitIntToData(num, bigEndian);
          break;
        case 4:
          builder.add32BitIntToData(num, bigEndian);
          break;
        case 8:
          builder.add64BitIntToData(num, bigEndian);
          break;
        case 16:
          builder.add128BitIntToData(num, bigEndian);
          break;
        case 32:
          builder.add256BitIntToData(num, bigEndian);
          break;
      }
    } else {
      switch (sizeInBits) {
        case 2:
          builder.add16BitUIntToData(num, bigEndian);
          break;
        case 4:
          builder.add32BitUIntToData(num, bigEndian);
          break;
        case 8:
          builder.add64BitUIntToData(num, bigEndian);
          break;
        case 16:
          builder.add128BitUIntToData(num, bigEndian);
          break;
        case 32:
          builder.add256BitUIntToData(num, bigEndian);
          break;
      }
    }
  };

  describe("clean", () => {
    beforeEach(() => {
      builder = new ByteArrayBuilder(APDU_MAX_PAYLOAD);
    });

    it("should create an instance", () => {
      expect(builder).toBeDefined();
      expect(builder).toBeInstanceOf(ByteArrayBuilder);
    });
  });

  describe("simple", () => {
    beforeEach(() => {
      builder = new ByteArrayBuilder(APDU_MAX_PAYLOAD);
    });

    it("should serialize with an empty body", () => {
      expect(builder.build()).toEqual(COMMAND_NO_BODY);
    });

    it("should serialize with an single byte body", () => {
      builder = new ByteArrayBuilder(1);
      builder.add8BitUIntToData(0x01);
      expect(builder.build()).toEqual(COMMAND_BODY_SINGLE);
      expect(builder.getErrors()).toEqual([]);
    });

    it.each([
      [2, false, true, 0x3302, "3302"],
      [2, false, false, 0x3302n, "0233"],
      [2, true, true, 4200n, "1068"],
      [2, true, true, -4200n, "ef98"],
      [2, true, false, 4200, "6810"],
      [2, true, false, -4200, "98ef"],
      [4, false, true, 0x01234567n, "01234567"],
      [4, false, false, 0x01234567n, "67452301"],
      [4, true, true, 123456789, "075bcd15"],
      [4, true, true, -123456789, "f8a432eb"],
      [4, true, false, 123456789, "15cd5b07"],
      [4, true, false, -123456789, "eb32a4f8"],
      [8, false, true, 14147778004927559n, "0032435442584447"],
      [8, false, false, 14147778004927559n, "4744584254433200"],
      [8, true, true, 14147778004927559n, "0032435442584447"],
      [8, true, true, -14147778004927559n, "ffcdbcabbda7bbb9"],
      [8, true, false, 14147778004927559n, "4744584254433200"],
      [8, true, false, -14147778004927559n, "b9bba7bdabbccdff"],
      [
        16,
        false,
        true,
        0x00324354425844470032435442584447n,
        "00324354425844470032435442584447",
      ],
      [
        16,
        false,
        false,
        0x00324354425844470032435442584447n,
        "47445842544332004744584254433200",
      ],
      [
        16,
        true,
        true,
        0x00324354425844470032435442584447n,
        "00324354425844470032435442584447",
      ],
      [
        16,
        true,
        true,
        -0x00324354425844470032435442584447n,
        "ffcdbcabbda7bbb8ffcdbcabbda7bbb9",
      ],
      [
        16,
        true,
        false,
        0x00324354425844470032435442584447n,
        "47445842544332004744584254433200",
      ],
      [
        16,
        true,
        false,
        -0x00324354425844470032435442584447n,
        "b9bba7bdabbccdffb8bba7bdabbccdff",
      ],
      [
        32,
        false,
        true,
        0x0032435442584447003243544258444700324354425844470032435442584447n,
        "0032435442584447003243544258444700324354425844470032435442584447",
      ],
      [
        32,
        false,
        false,
        0x0032435442584447003243544258444700324354425844470032435442584447n,
        "4744584254433200474458425443320047445842544332004744584254433200",
      ],
      [
        32,
        true,
        true,
        0x0032435442584447003243544258444700324354425844470032435442584447n,
        "0032435442584447003243544258444700324354425844470032435442584447",
      ],
      [
        32,
        true,
        true,
        -0x0032435442584447003243544258444700324354425844470032435442584447n,
        "ffcdbcabbda7bbb8ffcdbcabbda7bbb8ffcdbcabbda7bbb8ffcdbcabbda7bbb9",
      ],
      [
        32,
        true,
        false,
        0x0032435442584447003243544258444700324354425844470032435442584447n,
        "4744584254433200474458425443320047445842544332004744584254433200",
      ],
      [
        32,
        true,
        false,
        -0x0032435442584447003243544258444700324354425844470032435442584447n,
        "b9bba7bdabbccdffb8bba7bdabbccdffb8bba7bdabbccdffb8bba7bdabbccdff",
      ],
    ])(
      "serialize the following number: size %i, signed %s, bigEndian %s, value %i, expected %s",
      (sizeInBits, signed, bigEndian, input, output) => {
        builder = new ByteArrayBuilder(sizeInBits);
        builderAddNumber(input, bigEndian, sizeInBits, signed);
        expect(builder.build()).toEqual(hexaStringToBuffer(output));
        expect(builder.getErrors()).toEqual([]);

        // Retry with a buffer too small
        builder = new ByteArrayBuilder(sizeInBits - 1);
        builderAddNumber(input, bigEndian, sizeInBits, signed);
        expect(builder.getErrors().length).toEqual(1);
        expect(builder.build()).toEqual(Uint8Array.from([]));
      },
    );

    it.each([
      [2, false, true, 0xffffn, "ffff"],
      [2, true, true, 0x7fffn, "7fff"],
      [2, true, true, -0x8000n, "8000"],
      [4, false, true, 0xffffffffn, "ffffffff"],
      [4, true, true, 0x7fffffffn, "7fffffff"],
      [4, true, true, -0x80000000n, "80000000"],
      [8, false, true, 0xffffffffffffffffn, "ffffffffffffffff"],
      [8, true, true, 0x7fffffffffffffffn, "7fffffffffffffff"],
      [8, true, true, -0x8000000000000000n, "8000000000000000"],
      [
        16,
        false,
        true,
        0xffffffffffffffffffffffffffffffffn,
        "ffffffffffffffffffffffffffffffff",
      ],
      [
        16,
        true,
        true,
        0x7fffffffffffffffffffffffffffffffn,
        "7fffffffffffffffffffffffffffffff",
      ],
      [
        16,
        true,
        true,
        -0x80000000000000000000000000000000n,
        "80000000000000000000000000000000",
      ],
      [
        32,
        false,
        true,
        0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      ],
      [
        32,
        true,
        true,
        0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn,
        "7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      ],
      [
        32,
        true,
        true,
        -0x8000000000000000000000000000000000000000000000000000000000000000n,
        "8000000000000000000000000000000000000000000000000000000000000000",
      ],
    ])(
      "serialize the number to the limit: size %i, signed %s, bigEndian %s, value %i, expected %s",
      (sizeInBits, signed, bigEndian, input, output) => {
        builder = new ByteArrayBuilder(sizeInBits);
        builderAddNumber(input, bigEndian, sizeInBits, signed);
        expect(builder.build()).toEqual(hexaStringToBuffer(output));
        expect(builder.getErrors()).toEqual([]);
      },
    );

    it("Serialize from float to bigint", () => {
      builder = new ByteArrayBuilder(4);
      builder.add32BitIntToData(123456789.3, false);
      expect(builder.getErrors().length).toEqual(1);
      expect(builder.build()).toEqual(Uint8Array.from([]));
    });

    it("should serialize with an 5 byte body from an hexastring", () => {
      builder.addHexaStringToData("0x8081828384");
      expect(builder.build()).toEqual(COMMAND_BODY_HEXA1);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body from an hexastring without '0x'", () => {
      builder.addHexaStringToData("85868788");
      expect(builder.build()).toEqual(COMMAND_BODY_HEXA2);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body LV encoded from an hexastring", () => {
      builder.encodeInLVFromHexa("0xA1A2A3");
      expect(builder.build()).toEqual(COMMAND_BODY_LV_HEXA);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body LV encoded from an ascci string", () => {
      builder.encodeInLVFromAscii("maman");
      expect(builder.build()).toEqual(COMMAND_BODY_LV_ASCII);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body LV encoded from a buffer", () => {
      const myarray = new Uint8Array([0xf0, 0xf1]);
      builder.encodeInLVFromBuffer(myarray);
      expect(builder.build()).toEqual(COMMAND_BODY_LV_ARRAY);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an 4 byte body LV encoded from a buffer", () => {
      const myarray = new Uint8Array([0xf0, 0xf1]);
      builder.encodeInLVFromBuffer(myarray);
      expect(builder.build()).toEqual(COMMAND_BODY_LV_ARRAY);
      expect(builder.getErrors()).toEqual([]);
    });

    it("should serialize with an complete body of 0xAA", () => {
      const myarray = new Uint8Array(255).fill(0xaa, 0, 255);
      builder.addBufferToData(myarray);
      expect(builder.build()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getErrors()).toEqual([]);
    });
  });

  describe("mixed", () => {
    beforeEach(() => {
      builder = new ByteArrayBuilder(APDU_MAX_PAYLOAD);
    });

    it("should serialize with all previous field", () => {
      let available = APDU_MAX_PAYLOAD;
      builder.add8BitUIntToData(0x01);
      available--;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.add16BitUIntToData(0x3302);
      available -= 2;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.add32BitUIntToData(0x01234567);
      available -= 4;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.addHexaStringToData("0x8081828384");
      available -= 5;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.addHexaStringToData("85868788");
      available -= 4;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.encodeInLVFromHexa("0xA1A2A3");
      available -= 4;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      builder.encodeInLVFromAscii("maman");
      available -= 6;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      const myarray = new Uint8Array([0xf0, 0xf1]);
      builder.encodeInLVFromBuffer(myarray);
      available -= 3;
      expect(builder.getAvailablePayloadLength()).toBe(available);

      expect(builder.build()).toEqual(COMMAND_BODY_COMBINED);
    });
  });

  describe("error", () => {
    beforeEach(() => {
      builder = new ByteArrayBuilder(APDU_MAX_PAYLOAD);
    });

    it.each([
      [2, false, true, 0x10000n],
      [2, true, true, 0x8000n],
      [2, true, true, -0x8001n],
      [4, false, true, 0x100000000n],
      [4, true, true, 0x80000000n],
      [4, true, true, -0x80000001n],
      [8, false, true, 0x10000000000000000n],
      [8, true, true, 0x8000000000000000n],
      [8, true, true, -0x8000000000000001n],
    ])(
      "serialize the number overflowed: size %i, signed %s, bigEndian %s, value %i",
      (sizeInBits, signed, bigEndian, input) => {
        builder = new ByteArrayBuilder(sizeInBits);
        builderAddNumber(input, bigEndian, sizeInBits, signed);
        expect(builder.getErrors().length).toEqual(1);
        expect(builder.build()).toEqual(Uint8Array.from([]));
      },
    );

    it("error due to a string not well coded", () => {
      builder
        .addHexaStringToData(":08081828384")
        .addHexaStringToData("80818n8384")
        .addHexaStringToData("808182838z");

      expect(builder.build()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([
        new HexaStringEncodeError(":08081828384"),
        new HexaStringEncodeError("80818n8384"),
        new HexaStringEncodeError("808182838z"),
      ]);
    });

    it("error due direct overflow", () => {
      const myarray = new Uint8Array(256).fill(0xaa, 0, 256);
      builder.addBufferToData(myarray);
      expect(builder.build()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([
        new DataOverflowError(myarray.toString()),
      ]);
    });

    it("error due to subsequent overflow with 1-byte array", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      builder.addBufferToData(myarray);
      expect(builder.build()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      const mybuffer = new Uint8Array(1);
      mybuffer.set([0xff], 0);

      builder.addBufferToData(mybuffer);
      expect(builder.build()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
      expect(builder.getErrors()).toEqual([
        new DataOverflowError(mybuffer.toString()),
      ]);
    });

    it("error due to subsequent overflow with 1-char ascii", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      builder.addBufferToData(myarray);
      expect(builder.build()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      const mystring = "a";

      builder.addAsciiStringToData(mystring);
      expect(builder.build()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
      expect(builder.getErrors()).toEqual([
        new DataOverflowError(new TextEncoder().encode(mystring).toString()),
      ]);
    });

    it("error due to subsequent overflow with 1-char hexastring", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD,
      );
      builder.addBufferToData(myarray);
      expect(builder.build()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);

      const firstString = "0xB4";
      const secondString = "e1";

      builder
        .addHexaStringToData(firstString)
        .addHexaStringToData(secondString);

      expect(builder.build()).toEqual(COMMAND_BODY_MAX);
      expect(builder.getAvailablePayloadLength()).toBe(0);
      expect(builder.getErrors()).toEqual([
        new DataOverflowError((0xb4).toString()),
        new DataOverflowError((0xe1).toString()),
      ]);
    });

    it("error due to empty values", () => {
      const mystring = "";

      builder.addHexaStringToData(mystring).encodeInLVFromHexa(mystring);

      expect(builder.build()).toEqual(COMMAND_NO_BODY);
      expect(builder.getAvailablePayloadLength()).toBe(APDU_MAX_PAYLOAD);
      expect(builder.getErrors()).toEqual([
        new HexaStringEncodeError(mystring),
        new HexaStringEncodeError(mystring),
      ]);
    });

    it("error due to subsequent overflow with 1-char LV", () => {
      const myarray = new Uint8Array(APDU_MAX_PAYLOAD - 1).fill(
        0xaa,
        0,
        APDU_MAX_PAYLOAD - 1,
      );
      builder.addBufferToData(myarray);
      expect(builder.build()).toEqual(COMMAND_BODY_NEARLY);
      expect(builder.getAvailablePayloadLength()).toBe(1);

      const firstString = "n";
      const secondString = "e1";
      const mybuffer = new Uint8Array(1);
      mybuffer.set([0xff], 0);

      builder
        .encodeInLVFromAscii(firstString)
        .encodeInLVFromHexa(secondString)
        .encodeInLVFromBuffer(mybuffer);

      expect(builder.build()).toEqual(COMMAND_BODY_NEARLY);
      expect(builder.getAvailablePayloadLength()).toBe(1);
      expect(builder.getErrors()).toEqual([
        new DataOverflowError(firstString),
        new DataOverflowError(secondString),
        new DataOverflowError(mybuffer.toString()),
      ]);
    });
  });
});
