import { Command } from "./Command";
import { CommandTags, GeneralTags } from "./TLVTags";

describe("Command", () => {
  describe("toString", () => {
    it("should return the hex of the bytes of the command", () => {
      // WHEN
      const hex = "0102030405060708";
      const command = Command.fromHex(hex);
      // THEN
      expect(command.toString()).toBe(hex);
    });
  });

  describe("toU8A", () => {
    it("should return the bytes of the command", () => {
      // WHEN
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const command = new Command(bytes);
      // THEN
      expect(command.toU8A()).toBe(bytes);
    });
  });

  describe("getType", () => {
    it("should return the type of the command", () => {
      // WHEN
      const command = new Command(new Uint8Array([CommandTags.Seed, 1, 0x01]));
      // THEN
      expect(command.getType()).toBe(CommandTags.Seed);
    });

    it("should throw an error for invalid command type", () => {
      // WHEN
      const command = new Command(new Uint8Array([0xff, 1, 0x01]));
      // THEN
      expect(() => command.getType()).toThrow("Invalid command type: 0xff");
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
      const command = new Command(
        new Uint8Array([CommandTags.Seed, value.length, ...value]),
      );
      // THEN
      expect(command.parse<CommandTags.Seed>()).toEqual({
        type: CommandTags.Seed,
        topic: new Uint8Array([0x01, 0x02, 0x03]),
        protocolVersion: 258,
        groupKey: new Uint8Array([0x02, 0x04, 0x06]),
        initializationVector: new Uint8Array([0x03, 0x05, 0x07]),
        encryptedXpriv: new Uint8Array([0x04, 0x08, 0x10]),
        ephemeralPublicKey: new Uint8Array([0x0a, 0x0b, 0x0c]),
      });
    });

    it("should throw an error for invalid command bytes", () => {
      // WHEN
      const command = new Command(new Uint8Array([CommandTags.Seed, 1, 0x01]));
      // THEN
      expect(() => command.parse<CommandTags.Seed>()).toThrow(); // Can't check for the specific error because GeneralDmkError does not extends Error
    });
  });

  describe("getTrustedMember", () => {
    it("should return the trusted member for AddMember command", () => {
      // GIVEN
      const addMemberValue = new Uint8Array([
        ...[GeneralTags.String, 3, 0x41, 0x42, 0x43], // Name "ABC"
        ...[GeneralTags.PublicKey, 3, 0x04, 0x05, 0x06], // Public Key
        ...[GeneralTags.Int, 1, 0x01], // Permissions
      ]);

      // WHEN
      const addMemberCmd = new Command(
        new Uint8Array([
          CommandTags.AddMember,
          addMemberValue.length,
          ...addMemberValue,
        ]),
      );

      // THEN
      expect(addMemberCmd.getTrustedMember()).toEqual(
        new Uint8Array([0x04, 0x05, 0x06]),
      );
    });

    it("should return the trusted member for PublishKey commands", () => {
      // GIVEN
      const publishKeyValue = new Uint8Array([
        ...[GeneralTags.Bytes, 3, 0x01, 0x02, 0x03], // Initialization Vector
        ...[GeneralTags.Bytes, 3, 0x04, 0x05, 0x06], // Encrypted xpriv
        ...[GeneralTags.PublicKey, 3, 0x07, 0x08, 0x09], // Recipient
        ...[GeneralTags.PublicKey, 3, 0x0a, 0x0b, 0x0c], // Ephemeral Public Key
      ]);
      // WHEN
      const publishKeyCmd = new Command(
        new Uint8Array([
          CommandTags.PublishKey,
          publishKeyValue.length,
          ...publishKeyValue,
        ]),
      );
      // THEN
      expect(publishKeyCmd.getTrustedMember()).toEqual(
        new Uint8Array([0x07, 0x08, 0x09]),
      );
    });

    it("should return undefined for other command types", () => {
      // WHEN
      const command = new Command(new Uint8Array([CommandTags.Seed]));
      // THEN
      expect(command.getTrustedMember()).toBeUndefined();
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
      const command = new Command(
        new Uint8Array([CommandTags.PublishKey, value.length, ...value]),
      );
      // THEN
      expect(command.toHuman()).toBe(
        [
          `PublishKey(0x12):`,
          `  initializationVector: 010203`,
          `  encryptedXpriv: 040506`,
          `  recipient: 070809`,
          `  ephemeralPublicKey: 0a0b0c`,
        ].join("\n"),
      );
    });

    it("should throw an error for invalid command bytes format", () => {
      // WHEN
      const command = new Command(new Uint8Array([CommandTags.Seed, 1, 0x01]));
      // THEN
      expect(() => command.toHuman()).toThrow(); // Can't check for the specific error because GeneralDmkError does not extends Error
    });
  });
});
