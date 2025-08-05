import { Left, Right } from "purify-ts";

import { LKRPParsingError } from "@api/app-binder/Errors";

import { hexToBytes } from "./hex";
import { LKRPBlock } from "./LKRPBlock";
import { LKRPCommand } from "./LKRPCommand";
import { GeneralTags } from "./TLVTags";

// Mocked data for testing
const mockedBlockData = {
  parent: "0000",
  issuer: new Uint8Array([1, 2, 3]),
  commands: [LKRPCommand.fromHex("10020102"), LKRPCommand.fromHex("11020304")],
  signature: new Uint8Array([4, 5, 6]),
};
const mockedHeaderHex = [
  "010101", // Version: 1
  "02020000", // Parent hash: 00 00 00
  "0603010203", // Issuer: 01 02 03
  "010102", // Command Count: 2
].join("");
const mockedBlockHex = [
  ...mockedHeaderHex, // Header
  "10020102", // Command 1
  "11020304", // Command 2
  "0303040506", // Signature: 04 05 06
].join("");
const parsedMockedBlockData = {
  ...mockedBlockData,
  header: hexToBytes(mockedHeaderHex),
  signature: Uint8Array.from([
    GeneralTags.Signature,
    3,
    ...mockedBlockData.signature,
  ]),
};

describe("LKRPBlock", () => {
  describe("fromData", () => {
    it("should create a Block from data", () => {
      // WHEN
      const block = LKRPBlock.fromData(mockedBlockData);
      // THEN
      expect(block.parse()).toStrictEqual(Right(parsedMockedBlockData));
      expect(block.toString()).toBe(mockedBlockHex);
    });
  });

  describe("toString", () => {
    it("should return the hex representation of the block", () => {
      // WHEN
      const block = LKRPBlock.fromHex(mockedBlockHex);
      // THEN
      expect(block.toString()).toBe(mockedBlockHex);
    });
  });

  describe("toU8A", () => {
    it("should return the bytes of the block", () => {
      // GIVEN
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      // WHEN
      const block = new LKRPBlock(bytes);
      // THEN
      expect(block.toU8A()).toBe(bytes);
    });
  });

  describe("parse", () => {
    it("should parse the block data correctly", () => {
      // GIVEN
      const block = LKRPBlock.fromHex(mockedBlockHex);
      // WHEN
      const parsedData = block.parse();
      // THEN
      expect(parsedData).toStrictEqual(Right(parsedMockedBlockData));
    });

    it("should fail if the block data is invalid", () => {
      // WHEN
      const invalidBlock = LKRPBlock.fromHex("invalid");
      // THEN
      expect(invalidBlock.parse()).toStrictEqual(
        Left(new LKRPParsingError("Unexpected end of TLV")),
      );
    });
  });

  describe("toHuman", () => {
    it("should return a human-readable representation of the block", () => {
      // GIVEN
      const hex = `
        01 01 01
        02 20 1d bf 17 52 c5 4b 9f b5 4f b7 c3 63 c1 e6 15 f7 2f d9 61 b7 97 e6 f0 9e 6c 1d 1b 6e db 28 5a 6d
        06 21 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 21
        01 01 03
        15 b8
          05 0c 80 00 00 00 80 00 00 10 80 00 00 01
          06 21 03 4f 37 31 2d 9b ab d8 c0 32 e1 dd 2d e3 3d a3 69 fa 1c e3 0f 00 5b bb a6 00 d1 73 30 ba 39 2c b2
          05 10 b6 da 2c 97 a3 ec 8b 07 4f 38 f1 50 8a ed 33 35
          05 50 d2 1f 8f 30 77 02 33 3f 7a 59 3b eb d7 98 a6 b0 6e b5 90 42 77 26 8a 91 35 0a 3c 1b 1e e6 7c 24 b5 a4 7d 22 8c 60 d0 fb c1 52 4e ac 1b cf 12 3e 6e 26 b5 d7 17 08 29 1c c0 8d cf 49 de 0b b3 4b ac f2 00 93 52 4c a6 56 5d 87 c6 36 b2 44 75 b2
          06 21 02 93 fe b6 64 12 53 6d 3d 71 d5 c7 af ac 96 a3 6e a8 c6 85 88 9e eb cf 6f 6f 82 68 57 12 fe f1 50
        11 37
          04 0c 64 65 62 75 67 2d 64 34 63 36 31 64
          06 21 03 d4 c6 1d da 2a af 76 29 54 fc e9 73 96 d9 be 03 99 e1 dc 75 c3 b7 90 c7 a3 4d de 85 96 a1 18 12
          01 04 ff ff ff ff
        12 aa
          05 10 e7 b7 36 c4 0b 14 a8 30 fb 23 aa de d8 ea e5 44
          05 50 df 7e 80 8c 79 46 75 d0 a2 d4 66 d4 ef c8 ec d0 7d 52 36 80 16 10 0d 34 d6 fd b8 e6 da 86 e9 2f bb b7 11 0c b5 64 29 b8 3b 1c b9 74 ed 4b 70 51 43 f6 91 b5 b8 14 68 ab d2 c5 26 26 6a 6d ee 6d f4 fd f1 a9 d8 1f e7 4c da 4f 61 c9 89 60 b4 db
          06 21 03 d4 c6 1d da 2a af 76 29 54 fc e9 73 96 d9 be 03 99 e1 dc 75 c3 b7 90 c7 a3 4d de 85 96 a1 18 12
          06 21 02 45 f1 1d 7d 78 bd 22 76 45 11 8a bb 20 b4 07 ff 97 8d f8 7a 6b b3 c4 46 1d 63 37 66 85 8f 98 f5
        03 47 30 45 02 21 00 a0 ea 9d ee 12 f3 83 13 2f 90 72 ad 47 85 a4 15 14 75 d5 70 4a a9 ff 7f 95 52 e9 03 47 b4 ce be 02 20 71 a3 e4 4c 1f 4f a6 4b c6 e2 f4 06 fa 00 fc b4 6f 70 1c 99 49 29 12 bf 33 c7 3e df b2 d5 d1 71
      `.replace(/\s/g, "");

      // WHEN
      const block = LKRPBlock.fromHex(hex);
      const humanReadable = block.toHuman();

      // THEN
      expect(humanReadable).toStrictEqual(
        Right(
          [
            `Parent: 1dbf1752c54b9fb54fb7c363c1e615f72fd961b797e6f09e6c1d1b6edb285a6d`,
            `Issuer: 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021`,
            `Commands:`,
            `  Derive(0x15):`,
            `    path: m/0'/16'/1'`,
            `    groupKey: 034f37312d9babd8c032e1dd2de33da369fa1ce30f005bbba600d17330ba392cb2`,
            `    initializationVector: b6da2c97a3ec8b074f38f1508aed3335`,
            `    encryptedXpriv: d21f8f307702333f7a593bebd798a6b06eb5904277268a91350a3c1b1ee67c24b5a47d228c60d0fbc1524eac1bcf123e6e26b5d71708291cc08dcf49de0bb34bacf20093524ca6565d87c636b24475b2`,
            `    ephemeralPublicKey: 0293feb66412536d3d71d5c7afac96a36ea8c685889eebcf6f6f82685712fef150`,
            `  AddMember(0x11):`,
            `    name: debug-d4c61d`,
            `    publicKey: 03d4c61dda2aaf762954fce97396d9be0399e1dc75c3b790c7a34dde8596a11812`,
            `    permissions: 4294967295`,
            `  PublishKey(0x12):`,
            `    initializationVector: e7b736c40b14a830fb23aaded8eae544`,
            `    encryptedXpriv: df7e808c794675d0a2d466d4efc8ecd07d52368016100d34d6fdb8e6da86e92fbbb7110cb56429b83b1cb974ed4b705143f691b5b81468abd2c526266a6dee6df4fdf1a9d81fe74cda4f61c98960b4db`,
            `    recipient: 03d4c61dda2aaf762954fce97396d9be0399e1dc75c3b790c7a34dde8596a11812`,
            `    ephemeralPublicKey: 0245f11d7d78bd227645118abb20b407ff978df87a6bb3c4461d633766858f98f5`,
            `Signature: 3045022100a0ea9dee12f383132f9072ad4785a4151475d5704aa9ff7f9552e90347b4cebe022071a3e44c1f4fa64bc6e2f406fa00fcb46f701c99492912bf33c73edfb2d5d171`,
          ].join("\n"),
        ),
      );
    });
  });

  describe("hash", () => {
    it("should return the hash of the block", () => {
      // GIVEN
      const block = LKRPBlock.fromHex(mockedBlockHex);
      // WHEN
      const hash = block.hash();
      // THEN
      expect(hash).toBe(
        "7cf783bc15c062242ab92796237da3b192361da7645c488d5023698d4f9cc952",
      );
    });
  });
});
