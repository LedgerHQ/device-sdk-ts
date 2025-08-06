import { Left, Right } from "purify-ts";

import { LKRPParsingError } from "@api/app-binder/Errors";
import { CommandTags, GeneralTags } from "@internal/models/Tags";

import { LKRPCommand } from "./LKRPCommand";
import { TLVParser } from "./TLVParser";

describe("TLVParser", () => {
  describe("Block Data Parsing", () => {
    describe("parseCommands", () => {
      it("should parse has many commands has specified by the command count value", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([
            ...[GeneralTags.Int, 1, 0x02], // Command count: 2
            ...[CommandTags.AddMember, 3, ...[GeneralTags.Int, 1, 0x01]], // First command
            ...[CommandTags.Seed, 3, ...[GeneralTags.Int, 1, 0x02]], // Second command
          ]),
        );
        // WHEN
        const commands = parser.parseCommands();

        // THEN
        expect(commands).toStrictEqual(
          Right([
            new LKRPCommand(
              new Uint8Array([
                CommandTags.AddMember,
                3,
                ...[GeneralTags.Int, 1, 0x01],
              ]),
            ),
            new LKRPCommand(
              new Uint8Array([
                CommandTags.Seed,
                3,
                ...[GeneralTags.Int, 1, 0x02],
              ]),
            ),
          ]),
        );
      });
    });

    describe("parseBlockData", () => {
      it("should parse a valid block data", () => {
        // GIVEN
        const parser = new TLVParser(
          Uint8Array.from(
            [
              [GeneralTags.Int, 1, 0x01], // Version
              [GeneralTags.Hash, 3, 0x01, 0x02, 0x03], // Parent
              [GeneralTags.PublicKey, 3, 0x04, 0x05, 0x06], // Issuer
              [GeneralTags.Int, 1, 0x02], // Command count: 2
              [CommandTags.AddMember, 3, ...[GeneralTags.Int, 1, 0x01]], // First command
              [CommandTags.Seed, 3, ...[GeneralTags.Int, 1, 0x02]], // Second command
              [GeneralTags.Signature, 3, 0x07, 0x08, 0x09], // Signature
            ].flat(),
          ),
        );
        // WHEN
        const blockData = parser.parseBlockData();

        // THEN
        expect(blockData).toStrictEqual(
          Right({
            parent: "010203",
            issuer: new Uint8Array([0x04, 0x05, 0x06]),
            header: Uint8Array.from(
              [
                [GeneralTags.Int, 1, 0x01], // Version
                [GeneralTags.Hash, 3, 0x01, 0x02, 0x03], // Parent
                [GeneralTags.PublicKey, 3, 0x04, 0x05, 0x06], // Issuer
                [GeneralTags.Int, 1, 0x02], // Command count: 2
              ].flat(),
            ),

            commands: [
              new LKRPCommand(
                new Uint8Array([
                  CommandTags.AddMember,
                  3,
                  ...[GeneralTags.Int, 1, 0x01],
                ]),
              ),
              new LKRPCommand(
                new Uint8Array([
                  CommandTags.Seed,
                  3,
                  ...[GeneralTags.Int, 1, 0x02],
                ]),
              ),
            ],
            signature: Uint8Array.from([
              GeneralTags.Signature,
              3,
              0x07,
              0x08,
              0x09,
            ]),
          }),
        );
      });

      it("should fail if the block data is invalid", () => {
        // GIVEN
        const parser = new TLVParser(new Uint8Array([]));
        // WHEN
        const blockData = parser.parseBlockData();
        // THEN
        expect(blockData).toEqual(
          Left(new LKRPParsingError("Unexpected end of TLV")),
        );
      });
    });
  });

  describe("Command Data Parsing", () => {
    describe("parseCommandBytes", () => {
      it("should parse a valid command bytes", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([CommandTags.AddMember, 3, 0x01, 0x02, 0x03]),
        );
        // WHEN
        const value = parser.parseCommandBytes();
        // THEN
        expect(value).toEqual(
          Right(new Uint8Array([CommandTags.AddMember, 3, 0x01, 0x02, 0x03])),
        );
      });

      it("should fail if the tag is not a command", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 1, 0x01]),
        );
        // WHEN
        const value = parser.parseCommandBytes();
        // THEN
        expect(value).toEqual(
          Left(new LKRPParsingError(`Invalid command type: 0x01`)),
        );
      });
    });

    describe("Parse Seed Command Data", () => {
      it("should parse a valid seed command data", () => {
        // GIVEN
        const value = new Uint8Array([
          ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Topic
          ...[GeneralTags.Int, 2, 0x01, 0x02], // Protocol Version
          ...[GeneralTags.PublicKey, 3, 0x02, 0x04, 0x06], // Group Key
          ...[GeneralTags.Bytes, 3, 0x03, 0x05, 0x07], // Initialization Vector
          ...[GeneralTags.Bytes, 3, 0x04, 0x08, 0x10], // Encrypted xpriv
          ...[GeneralTags.PublicKey, 3, 0x0a, 0x0b, 0x0c], // Ephemeral Public Key
        ]);
        const parser = new TLVParser(
          new Uint8Array([CommandTags.Seed, value.length, ...value]),
        );

        // WHEN
        const parsed = parser.parseCommandData();

        // THEN
        expect(parsed).toStrictEqual(
          Right({
            type: CommandTags.Seed,
            topic: new Uint8Array([0x01, 0x02, 0x03]),
            protocolVersion: 258, // 0x0102 in big-endian
            groupKey: new Uint8Array([0x02, 0x04, 0x06]),
            initializationVector: new Uint8Array([0x03, 0x05, 0x07]),
            encryptedXpriv: new Uint8Array([0x04, 0x08, 0x10]),
            ephemeralPublicKey: new Uint8Array([0x0a, 0x0b, 0x0c]),
          }),
        );
      });

      it("should fail if the command data is invalid", () => {
        // GIVEN
        const value1 = new Uint8Array([
          ...[GeneralTags.Signature, 3, 0x01, 0x02, 0x03], // Wrong type for Topic
        ]);
        const value2 = new Uint8Array([
          ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Correct type but the other fields are missing
        ]);
        const parser1 = new TLVParser(
          new Uint8Array([CommandTags.Seed, value1.length, ...value1]),
        );
        const parser2 = new TLVParser(
          new Uint8Array([CommandTags.Seed, value2.length, ...value2]),
        );

        // WHEN
        const parsed1 = parser1.parseCommandData();
        const parsed2 = parser2.parseCommandData();

        // THEN
        expect(parsed1).toEqual(Left(new LKRPParsingError("Expected bytes")));
        expect(parsed2).toEqual(
          Left(new LKRPParsingError("Unexpected end of TLV")),
        );
      });
    });

    describe("Parse AddMember Command Data", () => {
      it("should parse a valid add member command data", () => {
        // GIVEN
        const value = new Uint8Array([
          ...[GeneralTags.String, 5, 0x41, 0x6c, 0x69, 0x63, 0x65], // Name "Alice"
          ...[GeneralTags.PublicKey, 3, 0x01, 0x02, 0x03], // Public Key
          ...[GeneralTags.Int, 1, 0x01], // Permissions
        ]);
        const parser = new TLVParser(
          new Uint8Array([CommandTags.AddMember, value.length, ...value]),
        );

        // WHEN
        const parsed = parser.parseCommandData();

        // THEN
        expect(parsed).toStrictEqual(
          Right({
            type: CommandTags.AddMember,
            name: "Alice",
            publicKey: new Uint8Array([0x01, 0x02, 0x03]),
            permissions: 1,
          }),
        );
      });

      it("should fail if the command data is invalid", () => {
        // GIVEN
        const value1 = new Uint8Array([
          ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Wrong type for Name
        ]);
        const value2 = new Uint8Array([
          ...[GeneralTags.String, 5, 0x41, 0x6c, 0x69, 0x63, 0x65], // Correct type but the other fields are missing
        ]);
        const parser1 = new TLVParser(
          new Uint8Array([CommandTags.AddMember, value1.length, ...value1]),
        );
        const parser2 = new TLVParser(
          new Uint8Array([CommandTags.AddMember, value2.length, ...value2]),
        );

        // WHEN
        const parsed1 = parser1.parseCommandData();
        const parsed2 = parser2.parseCommandData();

        // THEN
        expect(parsed1).toEqual(
          Left(new LKRPParsingError("Expected a string")),
        );
        expect(parsed2).toEqual(
          Left(new LKRPParsingError("Unexpected end of TLV")),
        );
      });
    });

    describe("Parse PublishKey Command Data", () => {
      it("should parse a valid publish key command data", () => {
        // GIVEN
        const value = new Uint8Array([
          ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Initialization Vector
          ...[GeneralTags.Bytes, 3, 0x04, 0x05, 0x06], // Encrypted xpriv
          ...[GeneralTags.PublicKey, 3, 0x03, 0x05, 0x07], // Recipient Public Key
          ...[GeneralTags.PublicKey, 3, 0x08, 0x09, 0x0a], // Ephemeral Public Key
        ]);
        const parser = new TLVParser(
          new Uint8Array([CommandTags.PublishKey, value.length, ...value]),
        );

        // WHEN
        const parsed = parser.parseCommandData();

        // THEN
        expect(parsed).toStrictEqual(
          Right({
            type: CommandTags.PublishKey,
            initializationVector: new Uint8Array([0x01, 0x02, 0x03]),
            encryptedXpriv: new Uint8Array([0x04, 0x05, 0x06]),
            recipient: new Uint8Array([0x03, 0x05, 0x07]),
            ephemeralPublicKey: new Uint8Array([0x08, 0x09, 0x0a]),
          }),
        );
      });

      it("should fail if the command data is invalid", () => {
        // GIVEN
        const value1 = new Uint8Array([
          ...[GeneralTags.Int, 2, 0x01, 0x02], // Wrong type for Initialization Vector
        ]);
        const value2 = new Uint8Array([
          ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Correct type but the other fields are missing
        ]);
        const parser1 = new TLVParser(
          new Uint8Array([CommandTags.PublishKey, value1.length, ...value1]),
        );
        const parser2 = new TLVParser(
          new Uint8Array([CommandTags.PublishKey, value2.length, ...value2]),
        );

        // WHEN
        const parsed1 = parser1.parseCommandData();
        const parsed2 = parser2.parseCommandData();

        // THEN
        expect(parsed1).toEqual(Left(new LKRPParsingError("Expected bytes")));
        expect(parsed2).toEqual(
          Left(new LKRPParsingError("Unexpected end of TLV")),
        );
      });
    });

    describe("Parse Derive Command Data", () => {
      it("should parse a valid derive command data", () => {
        // GIVEN
        const value = new Uint8Array([
          ...[GeneralTags.Bytes, 4, 0x00, 0x00, 0x00, 0x01], // Path
          ...[GeneralTags.PublicKey, 3, 0x04, 0x05, 0x06], // Group Key
          ...[GeneralTags.Bytes, 3, 0x03, 0x05, 0x07], // Initialization Vector
          ...[GeneralTags.Bytes, 3, 0x08, 0x09, 0x0a], // Encrypted xpriv
          ...[GeneralTags.PublicKey, 3, 0x0a, 0x0b, 0x0c], // Ephemeral Public Key
        ]);
        const parser = new TLVParser(
          new Uint8Array([CommandTags.Derive, value.length, ...value]),
        );

        // WHEN
        const parsed = parser.parseCommandData();

        // THEN
        expect(parsed).toStrictEqual(
          Right({
            type: CommandTags.Derive,
            path: "m/1",
            groupKey: new Uint8Array([0x04, 0x05, 0x06]),
            initializationVector: new Uint8Array([0x03, 0x05, 0x07]),
            encryptedXpriv: new Uint8Array([0x08, 0x09, 0x0a]),
            ephemeralPublicKey: new Uint8Array([0x0a, 0x0b, 0x0c]),
          }),
        );
      });

      it("should fail if the command data is invalid", () => {
        // GIVEN
        const value1 = new Uint8Array([
          ...[GeneralTags.Int, 2, 0x01, 0x02], // Wrong type for Path
        ]);
        const value2 = new Uint8Array([
          ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Correct type but the other fields are missing
        ]);
        const parser1 = new TLVParser(
          new Uint8Array([CommandTags.Derive, value1.length, ...value1]),
        );
        const parser2 = new TLVParser(
          new Uint8Array([CommandTags.Derive, value2.length, ...value2]),
        );

        // WHEN
        const parsed1 = parser1.parseCommandData();
        const parsed2 = parser2.parseCommandData();

        // THEN
        expect(parsed1).toEqual(Left(new LKRPParsingError("Expected bytes")));
        expect(parsed2).toEqual(
          Left(new LKRPParsingError("Unexpected end of TLV")),
        );
      });
    });

    it("should fail on unsupported command type", () => {
      // GIVEN
      const parser = new TLVParser(new Uint8Array([0x3f, 1, 0x01]));
      // WHEN
      const parsed = parser.parseCommandData();
      // THEN
      expect(parsed).toEqual(
        Left(new LKRPParsingError("Unsupported command type: 0x3f")),
      );
    });
  });

  describe("General Types Parsing", () => {
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
          Left(new LKRPParsingError("Unexpected end of TLV")),
        );
        expect(value2).toEqual(
          Left(new LKRPParsingError("Invalid end of TLV, expected length")),
        );
        expect(value3).toEqual(
          Left(new LKRPParsingError("Invalid end of TLV value")),
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
        expect(value).toEqual(Left(new LKRPParsingError("Expected null")));
      });

      it("should fail if the format is invalid", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Null, 1, 0x02]),
        );
        // WHEN
        const value = parser.parseNull();
        // THEN
        expect(value).toEqual(
          Left(new LKRPParsingError("Invalid null length")),
        );
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
        expect(value).toEqual(Left(new LKRPParsingError("Expected a number")));
      });

      it("should fail if the integer is not 1, 2, or 4 bytes", () => {
        // GIVEN
        const parser = new TLVParser(
          new Uint8Array([GeneralTags.Int, 3, 0x01, 0x02, 0x03]),
        );
        // WHEN
        const value = parser.parseInt();
        // THEN
        expect(value).toEqual(
          Left(new LKRPParsingError("Unsupported integer length")),
        );
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
        expect(value).toEqual(Left(new LKRPParsingError("Expected a hash")));
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
        expect(value).toEqual(
          Left(new LKRPParsingError("Expected a signature")),
        );
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
        expect(value).toEqual(Left(new LKRPParsingError("Expected a string")));
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
        expect(value).toEqual(Left(new LKRPParsingError("Expected bytes")));
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
        expect(value).toEqual(
          Left(new LKRPParsingError("Expected a public key")),
        );
      });
    });
  });
});
