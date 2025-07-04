import { Left, Right } from "purify-ts";

import { TLVParser } from "./TLVParser";
import { GeneralTags } from "./TLVTags";

describe("TLVParser", () => {
  describe("GeneralTags", () => {
    describe("parse", () => {
      it("should parse a valid TLV structure", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 1, 0x01, GeneralTags.Bytes, 0]),
        );
        // WHEN
        const value1 = parser.parse();
        const value2 = parser.parse();
        // THEN
        expect(value1).toEqual(Right({ tag: GeneralTags.Int, value: 1 }));
        expect(value2).toEqual(
          Right({ tag: GeneralTags.Bytes, value: new Uint8Array([]) }),
        );
      });

      it("should fail on invalid TLV structure", () => {
        // GIVEN
        const parser1 = new TLVParser(new Uint8Array([]));
        const parser2 = new TLVParser(new Uint8Array([GeneralTags.Int]));
        const parser3 = new TLVParser(new Uint8Array([GeneralTags.Int, 2]));
        // WHEN
        const value1 = parser1.parse();
        const value2 = parser2.parse();
        const value3 = parser3.parse();
        // THEN
        expect(value1).toEqual(
          Left(new Error("No more data to parse at offset 0")),
        );
        expect(value2).toEqual(
          Left(new Error("Invalid end of TLV, expected length at offset 1")),
        );
        expect(value3).toEqual(
          Left(new Error("Invalid end of TLV value at offset 2")),
        );
      });
    });

    describe("parseNull", () => {
      it("should parse a null value", () => {
        // GIVEN
        const parser = new TLVParser(new Uint8Array([GeneralTags.Null, 0]));
        // WHEN
        const value = parser.parseNull();
        // THEN
        expect(value).toEqual(Right(null));
      });

      it("should fail if the tag is not null", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 1, 0x01]),
        );
        // WHEN
        const value = parser.parseNull();
        // THEN
        expect(value).toEqual(Left(new Error("Expected null")));
      });

      it("should fail if the format is invalid", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Null, 1, 0x02]),
        );
        // WHEN
        const value = parser.parseNull();
        // THEN
        expect(value).toEqual(Left(new Error("Invalid null length")));
      });
    });

    describe("parseInt", () => {
      it("should parse big endian integer values", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([
            ...[GeneralTags.Int, 1, 0x01], // 1
            ...[GeneralTags.Int, 2, 0x01, 0x00], // 256
            ...[GeneralTags.Int, 4, 0x01, 0x00, 0x00, 0x00], // 16777216
          ]),
        );
        // WHEN
        const value1 = parser.parseInt();
        const value2 = parser.parseInt();
        const value4 = parser.parseInt();
        // THEN
        expect(value1).toEqual(Right(1));
        expect(value2).toEqual(Right(256));
        expect(value4).toEqual(Right(16777216));
      });

      it("should fail if the tag is not an integer", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Bytes, 1, 0x01]),
        );
        // WHEN
        const value = parser.parseInt();
        // THEN
        expect(value).toEqual(Left(new Error("Expected a number")));
      });

      it("should fail if the integer is not 1, 2, or 4 bytes", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 3, 0x01, 0x02, 0x03]),
        );
        // WHEN
        const value = parser.parseInt();
        // THEN
        expect(value).toEqual(Left(new Error("Unsupported integer length")));
      });
    });

    describe("parseHash", () => {
      it("should parse a hash value", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Hash, 3, 0x01, 0x02, 0x03]),
        );
        // WHEN
        const value = parser.parseHash();
        // THEN
        expect(value).toEqual(Right(new Uint8Array([0x01, 0x02, 0x03])));
      });

      it("should fail if the tag is not a hash", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 1, 0x01]),
        );
        // WHEN
        const value = parser.parseHash();
        // THEN
        expect(value).toEqual(Left(new Error("Expected a hash")));
      });
    });

    describe("parseSignature", () => {
      it("should parse a signature value", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Signature, 3, 0x01, 0x02, 0x03]),
        );
        // WHEN
        const value = parser.parseSignature();
        // THEN
        expect(value).toEqual(Right(new Uint8Array([0x01, 0x02, 0x03])));
      });

      it("should fail if the tag is not a signature", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 1, 0x01]),
        );
        // WHEN
        const value = parser.parseSignature();
        // THEN
        expect(value).toEqual(Left(new Error("Expected a signature")));
      });
    });

    describe("parseString", () => {
      it("should parse a string value", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.String, 5, 0x48, 0x65, 0x6c, 0x6c, 0x6f]),
        );
        // WHEN
        const value = parser.parseString();
        // THEN
        expect(value).toEqual(Right("Hello"));
      });

      it("should fail if the tag is not a string", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 1, 0x01]),
        );
        // WHEN
        const value = parser.parseString();
        // THEN
        expect(value).toEqual(Left(new Error("Expected a string")));
      });
    });

    describe("parseBytes", () => {
      it("should parse a bytes value", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Bytes, 3, 0x01, 0x02, 0x03]),
        );
        // WHEN
        const value = parser.parseBytes();
        // THEN
        expect(value).toEqual(Right(new Uint8Array([0x01, 0x02, 0x03])));
      });

      it("should fail if the tag is not bytes", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 1, 0x01]),
        );
        // WHEN
        const value = parser.parseBytes();
        // THEN
        expect(value).toEqual(Left(new Error("Expected bytes")));
      });
    });

    describe("parsePublicKey", () => {
      it("should parse a public key value", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.PublicKey, 3, 0x01, 0x02, 0x03]),
        );
        // WHEN
        const value = parser.parsePublicKey();
        // THEN
        expect(value).toEqual(Right(new Uint8Array([0x01, 0x02, 0x03])));
      });

      it("should fail if the tag is not a public key", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 1, 0x01]),
        );
        // WHEN
        const value = parser.parsePublicKey();
        // THEN
        expect(value).toEqual(Left(new Error("Expected a public key")));
      });
    });
  });
});
