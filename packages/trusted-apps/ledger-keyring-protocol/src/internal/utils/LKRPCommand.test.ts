import { Just, Left, Nothing, Right } from "purify-ts";

import { LKRPParsingError } from "@api/model/Errors";
import { Permissions } from "@api/model/Permissions";
import { CommandTags, GeneralTags } from "@internal/models/Tags";

import { LKRPCommand } from "./LKRPCommand";

describe("LKRPCommand", () => {
  describe("fromData", () => {
    it("should encode add member permissions correctly", () => {
      // GIVEN
      const publicKey = Uint8Array.from([
        0x02, 0xbf, 0x5c, 0x0d, 0x9b, 0xf0, 0xf4, 0x95, 0x16, 0x28, 0x5a, 0xd2,
        0x03, 0x92, 0xc4, 0xc4, 0xb8, 0x71, 0x14, 0xf6, 0xc4, 0x8c, 0x84, 0x73,
        0x06, 0xde, 0x1f, 0xe7, 0xf3, 0x93, 0x4e, 0x43, 0xc1,
      ]);
      // WHEN
      const addOwner = LKRPCommand.fromData({
        type: CommandTags.AddMember,
        name: "OWNER",
        publicKey,
        permissions: Permissions.OWNER,
      });
      const addReader = LKRPCommand.fromData({
        type: CommandTags.AddMember,
        name: "READER",
        publicKey,
        permissions: Permissions.CAN_ENCRYPT,
      });
      const dapp = LKRPCommand.fromData({
        type: CommandTags.AddMember,
        name: "DAPP",
        publicKey,
        permissions: Permissions.OWNER & ~Permissions.CAN_ADD_BLOCK,
      });
      // THEN
      expect(addOwner.toString()).toBe(
        [
          "11 30", // header
          "04 05 4f 57 4e 45 52", // name
          "06 21 02 bf 5c 0d 9b f0 f4 95 16 28 5a d2 03 92 c4 c4 b8 71 14 f6 c4 8c 84 73 06 de 1f e7 f3 93 4e 43 c1", // public key
          "01 04 ff ff ff ff", // permissions (OWNER)
        ]
          .join("")
          .replace(/ /g, ""),
      );
      expect(addReader.toString()).toBe(
        [
          "11 31", // header
          "04 06 52 45 41 44 45 52", // name
          "06 21 02 bf 5c 0d 9b f0 f4 95 16 28 5a d2 03 92 c4 c4 b8 71 14 f6 c4 8c 84 73 06 de 1f e7 f3 93 4e 43 c1", // public key
          "01 04 00 00 00 01", // permissions (CAN_ENCRYPT)
        ]
          .join("")
          .replace(/ /g, ""),
      );
      expect(dapp.toString()).toBe(
        [
          "11 2f", // header
          "04 04 44 41 50 50", // name
          "06 21 02 bf 5c 0d 9b f0 f4 95 16 28 5a d2 03 92 c4 c4 b8 71 14 f6 c4 8c 84 73 06 de 1f e7 f3 93 4e 43 c1", // public key
          "01 04 ff ff ff fb", // permissions (OWNER & ~CAN_ADD_BLOCK)
        ]
          .join("")
          .replace(/ /g, ""),
      );
    });
  });

  describe("bytesFromUnsignedData", () => {
    it("should encode add member permissions correctly", () => {
      // GIVEN
      const publicKey = Uint8Array.from([
        0x02, 0xbf, 0x5c, 0x0d, 0x9b, 0xf0, 0xf4, 0x95, 0x16, 0x28, 0x5a, 0xd2,
        0x03, 0x92, 0xc4, 0xc4, 0xb8, 0x71, 0x14, 0xf6, 0xc4, 0x8c, 0x84, 0x73,
        0x06, 0xde, 0x1f, 0xe7, 0xf3, 0x93, 0x4e, 0x43, 0xc1,
      ]);
      // WHEN
      const addOwner = LKRPCommand.bytesFromUnsignedData({
        type: CommandTags.AddMember,
        name: "OWNER",
        publicKey,
        permissions: Permissions.OWNER,
      });
      const addReader = LKRPCommand.bytesFromUnsignedData({
        type: CommandTags.AddMember,
        name: "READER",
        publicKey,
        permissions: Permissions.CAN_ENCRYPT,
      });
      const dapp = LKRPCommand.bytesFromUnsignedData({
        type: CommandTags.AddMember,
        name: "DAPP",
        publicKey,
        permissions: Permissions.OWNER & ~Permissions.CAN_ADD_BLOCK,
      });
      // THEN
      expect(addOwner).toEqual(
        Uint8Array.from(
          [
            [0x11, 0x30], // header
            [0x04, 0x05, 0x4f, 0x57, 0x4e, 0x45, 0x52], // name
            [
              // public key
              0x06, 0x21, 0x02, 0xbf, 0x5c, 0x0d, 0x9b, 0xf0, 0xf4, 0x95, 0x16,
              0x28, 0x5a, 0xd2, 0x03, 0x92, 0xc4, 0xc4, 0xb8, 0x71, 0x14, 0xf6,
              0xc4, 0x8c, 0x84, 0x73, 0x06, 0xde, 0x1f, 0xe7, 0xf3, 0x93, 0x4e,
              0x43, 0xc1,
            ],
            [0x01, 0x04, 0xff, 0xff, 0xff, 0xff], // permissions (OWNER)
          ].flat(),
        ),
      );
      expect(addReader).toEqual(
        Uint8Array.from(
          [
            [0x11, 0x31], // header
            [0x04, 0x06, 0x52, 0x45, 0x41, 0x44, 0x45, 0x52], // name
            [
              // public key
              0x06, 0x21, 0x02, 0xbf, 0x5c, 0x0d, 0x9b, 0xf0, 0xf4, 0x95, 0x16,
              0x28, 0x5a, 0xd2, 0x03, 0x92, 0xc4, 0xc4, 0xb8, 0x71, 0x14, 0xf6,
              0xc4, 0x8c, 0x84, 0x73, 0x06, 0xde, 0x1f, 0xe7, 0xf3, 0x93, 0x4e,
              0x43, 0xc1,
            ],
            [0x01, 0x04, 0x00, 0x00, 0x00, 0x01], // permissions (CAN_ENCRYPT)
          ].flat(),
        ),
      );
      expect(dapp).toEqual(
        Uint8Array.from(
          [
            [0x11, 0x2f], // header
            [0x04, 0x04, 0x44, 0x41, 0x50, 0x50], // name
            [
              // public key
              0x06, 0x21, 0x02, 0xbf, 0x5c, 0x0d, 0x9b, 0xf0, 0xf4, 0x95, 0x16,
              0x28, 0x5a, 0xd2, 0x03, 0x92, 0xc4, 0xc4, 0xb8, 0x71, 0x14, 0xf6,
              0xc4, 0x8c, 0x84, 0x73, 0x06, 0xde, 0x1f, 0xe7, 0xf3, 0x93, 0x4e,
              0x43, 0xc1,
            ],
            [0x01, 0x04, 0xff, 0xff, 0xff, 0xfb], // permissions (OWNER & ~CAN_ADD_BLOCK)
          ].flat(),
        ),
      );
    });
  });

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
            `  initializationVector(3): 010203`,
            `  encryptedXpriv(3): 040506`,
            `  recipient(3): 070809`,
            `  ephemeralPublicKey(3): 0a0b0c`,
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
        Left("Error: Invalid end of TLV, expected length"),
      );
    });
  });
});
