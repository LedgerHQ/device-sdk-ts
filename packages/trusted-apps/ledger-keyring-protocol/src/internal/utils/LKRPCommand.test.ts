import { Just, Left, Nothing, Right } from "purify-ts";

import { LKRPParsingError } from "@api/model/Errors";
import { CommandTags, GeneralTags } from "@internal/models/Tags";

import { LKRPCommand } from "./LKRPCommand";

describe("LKRPCommand", () => {
  describe("toString", () => {
    it("should return the hex of the bytes of the command", () => {
      // WHEN
      const hex = "0102030405060708";
      const command = LKRPCommand.fromHex(hex);
      // THEN
      expect(command.toString()).toBe(hex);
    });
  });

  describe("toU8A", () => {
    it("should return the bytes of the command", () => {
      // WHEN
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const command = new LKRPCommand(bytes);
      // THEN
      expect(command.toU8A()).toBe(bytes);
    });
  });

  describe("parse", () => {
    it("should parse the command data correctly", () => {
      // GIVEN
      const value = new Uint8Array([
        ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Topic
        ...[GeneralTags.Int, 2, 0x01, 0x02], // Protocol Version
        ...[GeneralTags.PublicKey, 3, 0x02, 0x04, 0x06], // Group Key
        ...[GeneralTags.Bytes, 3, 0x03, 0x05, 0x07], // Initialization Vector
        ...[GeneralTags.Bytes, 3, 0x04, 0x08, 0x10], // Encrypted xpriv
        ...[GeneralTags.PublicKey, 3, 0x0a, 0x0b, 0x0c], // Ephemeral Public Key
      ]);
      // WHEN
      const command = new LKRPCommand(
        new Uint8Array([CommandTags.Seed, value.length, ...value]),
      );
      // THEN
      expect(command.parse()).toStrictEqual(
        Right({
          type: CommandTags.Seed,
          topic: new Uint8Array([0x01, 0x02, 0x03]),
          protocolVersion: 258,
          groupKey: new Uint8Array([0x02, 0x04, 0x06]),
          initializationVector: new Uint8Array([0x03, 0x05, 0x07]),
          encryptedXpriv: new Uint8Array([0x04, 0x08, 0x10]),
          ephemeralPublicKey: new Uint8Array([0x0a, 0x0b, 0x0c]),
        }),
      );
    });

    it("should fail with invalid command bytes", () => {
      // WHEN
      const command = new LKRPCommand(
        new Uint8Array([CommandTags.Seed, 1, ...[0x01]]),
      );
      // THEN
      expect(command.parse()).toStrictEqual(
        Left(new LKRPParsingError("Invalid end of TLV, expected length")),
      );
    });
  });

  describe("getPublicKey", () => {
    it("should return the public key for AddMember command", () => {
      // GIVEN
      const addMemberValue = new Uint8Array([
        ...[GeneralTags.String, 3, 0x41, 0x42, 0x43], // Name "ABC"
        ...[GeneralTags.PublicKey, 3, 0x04, 0x05, 0x06], // Public Key
        ...[GeneralTags.Int, 1, 0x01], // Permissions
      ]);

      // WHEN
      const addMemberCmd = new LKRPCommand(
        new Uint8Array([
          CommandTags.AddMember,
          addMemberValue.length,
          ...addMemberValue,
        ]),
      );

      // THEN
      expect(addMemberCmd.getPublicKey()).toStrictEqual(Just("040506"));
    });

    it("should return the public key for PublishKey commands", () => {
      // GIVEN
      const publishKeyValue = new Uint8Array([
        ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Initialization Vector
        ...[GeneralTags.Bytes, 3, 0x04, 0x05, 0x06], // Encrypted xpriv
        ...[GeneralTags.PublicKey, 3, 0x07, 0x08, 0x09], // Recipient
        ...[GeneralTags.PublicKey, 3, 0x0a, 0x0b, 0x0c], // Ephemeral Public Key
      ]);
      // WHEN
      const publishKeyCmd = new LKRPCommand(
        new Uint8Array([
          CommandTags.PublishKey,
          publishKeyValue.length,
          ...publishKeyValue,
        ]),
      );
      // THEN
      expect(publishKeyCmd.getPublicKey()).toEqual(Just("070809"));
    });

    it("should return undefined for other command types", () => {
      // WHEN
      const command = new LKRPCommand(new Uint8Array([CommandTags.Seed]));
      // THEN
      expect(command.getPublicKey()).toEqual(Nothing);
    });
  });

  describe("toHuman", () => {
    it("should return a string representation of the command", () => {
      // GIVEN
      const value = new Uint8Array([
        ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Initialization Vector
        ...[GeneralTags.Bytes, 3, 0x04, 0x05, 0x06], // Encrypted xpriv
        ...[GeneralTags.PublicKey, 3, 0x07, 0x08, 0x09], // Recipient
        ...[GeneralTags.PublicKey, 3, 0x0a, 0x0b, 0x0c], // Ephemeral Public Key
      ]);
      // WHEN
      const command = new LKRPCommand(
        new Uint8Array([CommandTags.PublishKey, value.length, ...value]),
      );
      // THEN
      expect(command.toHuman()).toStrictEqual(
        Right(
          [
            `PublishKey(0x12):`,
            `  initializationVector: 010203`,
            `  encryptedXpriv: 040506`,
            `  recipient: 070809`,
            `  ephemeralPublicKey: 0a0b0c`,
          ].join("\n"),
        ),
      );
    });

    it("should fail for invalid command bytes format", () => {
      // WHEN
      const command = new LKRPCommand(
        new Uint8Array([CommandTags.Seed, 1, ...[0x01]]),
      );
      // THEN
      expect(command.toHuman()).toStrictEqual(
        Left(new LKRPParsingError("Invalid end of TLV, expected length")),
      );
    });
  });
});
