import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { NobleCryptoService } from "@api/crypto/noble/NobleCryptoService";
import { LKRPParsingError } from "@api/model/Errors";
import { GeneralTags } from "@internal/models/Tags";

import { LKRPBlock } from "./LKRPBlock";
import { LKRPCommand } from "./LKRPCommand";
import { noWS, unIndent } from "./testUtils";

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
  header: hexaStringToBuffer(mockedHeaderHex)!,
  signature: Uint8Array.from([
    GeneralTags.Signature,
    3,
    ...mockedBlockData.signature,
  ]),
};

describe("LKRPBlock", () => {
  const cryptoService = new NobleCryptoService();

  describe("fromData", () => {
    it("should create a Block from data", () => {
      // WHEN
      const block = LKRPBlock.fromData(cryptoService, mockedBlockData);
      // THEN
      expect(block.parse()).toStrictEqual(Right(parsedMockedBlockData));
      expect(block.toString()).toBe(mockedBlockHex);
    });
  });

  describe("toString", () => {
    it("should return the hex representation of the block", () => {
      // WHEN
      const block = LKRPBlock.fromHex(cryptoService, mockedBlockHex);
      // THEN
      expect(block.toString()).toBe(mockedBlockHex);
    });
  });

  describe("toU8A", () => {
    it("should return the bytes of the block", () => {
      // GIVEN
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      // WHEN
      const block = new LKRPBlock(cryptoService, bytes);
      // THEN
      expect(block.toU8A()).toBe(bytes);
    });
  });

  describe("parse", () => {
    it("should parse the block data correctly", () => {
      // GIVEN
      const block = LKRPBlock.fromHex(cryptoService, mockedBlockHex);
      // WHEN
      const parsedData = block.parse();
      // THEN
      expect(parsedData).toStrictEqual(Right(parsedMockedBlockData));
    });

    it("should fail if the block data is invalid", () => {
      // WHEN
      const invalidBlock = LKRPBlock.fromHex(cryptoService, "invalid");
      // THEN
      expect(invalidBlock.parse()).toStrictEqual(
        Left(new LKRPParsingError("Unexpected end of TLV")),
      );
    });
  });

  describe("toHuman", () => {
    it("should return a human-readable representation of the block", () => {
      // GIVEN
      const hex = noWS`
        01 01 01
        02 20 0a b5 73 f9 83 75 34 1b b8 71 49 75 de 3f 91 0c 7b 7a e9 8f 1c ac 50 45 d6 4c a1 09 6c 63 8a a8
        06 21 03 92 b7 60 e4 5b 36 4f 82 1e 59 80 82 27 46 63 a6 48 ad 65 35 8f 02 83 60 8d f3 7f 8b bf 50 fc 4d
        01 01 02
        11 2f
          04 04 30 32 63 65
          06 21 02 ce 94 77 cc 40 56 89 92 5f e1 d0 61 66 b5 02 36 f5 de 80 37 97 88 c5 59 d3 cb a2 a7 32 33 f0 00
          01 04 ff ff ff ff
        12 aa
          05 10 57 7b 56 51 4e 5a 2a 0a 64 61 1f fa d4 a1 b6 81
          05 50 f7 50 4e a3 06 64 c9 08 ee f6 3f 5e 7f b3 7e c3 d5 75 3b 76 f9 98 1a 80 6e e8 18 77 27 93 6b 72 f4 6e 64 95 5a 63 7a 55 ff df ba e8 ad 1a 1a bb 61 cc d5 d2 cf 21 18 3d eb 99 3a 79 bb e0 d8 54 aa bb 68 4a 87 b8 97 86 d0 48 25 34 05 e5 06 5a
          06 21 02 ce 94 77 cc 40 56 89 92 5f e1 d0 61 66 b5 02 36 f5 de 80 37 97 88 c5 59 d3 cb a2 a7 32 33 f0 00
          06 21 03 bc d4 a5 20 e6 2e fc 06 f4 ca 70 51 d7 4e 19 55 79 f9 70 94 17 92 5f 7a c8 24 01 5a 8c c8 e4 c4
        03 47 30 45 02 21 00 d8 ae 18 df 80 03 e1 eb 24 5b dc df b3 fc 18 34 c9 43 a7 7b 14 b0 f8 4c 7e 5d 0b 4e 6a 41 5b 28 02 20 57 e2 5e 44 d7 74 45 aa 48 50 45 13 5f da 1d 20 50 53 92 22 cb 52 0d d3 2f df e4 42 f9 80 7f 0c 
      `;

      // WHEN
      const block = LKRPBlock.fromHex(cryptoService, hex);
      const humanReadable = block.toHuman();

      // THEN
      expect(humanReadable).toStrictEqual(
        Right(unIndent`
          (isVerified: true, Hash: 4e4460fc88adfddbc9794469e8713e92ab8a096c41eed5d7f7c2e39a8cefbdfb)
            Hex: 01010102200ab573f98375341bb8714975de3f910c7b7ae98f1cac5045d64ca1096c638aa806210392b760e45b364f821e598082274663a648ad65358f0283608df37f8bbf50fc4d010102112f040430326365062102ce9477cc405689925fe1d06166b50236f5de80379788c559d3cba2a73233f0000104ffffffff12aa0510577b56514e5a2a0a64611ffad4a1b6810550f7504ea30664c908eef63f5e7fb37ec3d5753b76f9981a806ee8187727936b72f46e64955a637a55ffdfbae8ad1a1abb61ccd5d2cf21183deb993a79bbe0d854aabb684a87b89786d048253405e5065a062102ce9477cc405689925fe1d06166b50236f5de80379788c559d3cba2a73233f000062103bcd4a520e62efc06f4ca7051d74e195579f9709417925f7ac824015a8cc8e4c403473045022100d8ae18df8003e1eb245bdcdfb3fc1834c943a77b14b0f84c7e5d0b4e6a415b28022057e25e44d77445aa485045135fda1d2050539222cb520dd32fdfe442f9807f0c
            data:
              Parent(32): 0ab573f98375341bb8714975de3f910c7b7ae98f1cac5045d64ca1096c638aa8
              Issuer(33): 0392b760e45b364f821e598082274663a648ad65358f0283608df37f8bbf50fc4d
              Commands(2):
                AddMember(0x11):
                  name: "02ce"
                  publicKey(33): 02ce9477cc405689925fe1d06166b50236f5de80379788c559d3cba2a73233f000
                  permissions(4): 0xffffffff
                PublishKey(0x12):
                  initializationVector(16): 577b56514e5a2a0a64611ffad4a1b681
                  encryptedXpriv(80): f7504ea30664c908eef63f5e7fb37ec3d5753b76f9981a806ee8187727936b72f46e64955a637a55ffdfbae8ad1a1abb61ccd5d2cf21183deb993a79bbe0d854aabb684a87b89786d048253405e5065a
                  recipient(33): 02ce9477cc405689925fe1d06166b50236f5de80379788c559d3cba2a73233f000
                  ephemeralPublicKey(33): 03bcd4a520e62efc06f4ca7051d74e195579f9709417925f7ac824015a8cc8e4c4
              Signature
                0x30(69)
                0x02(33): d8ae18df8003e1eb245bdcdfb3fc1834c943a77b14b0f84c7e5d0b4e6a415b28
                0x02(32): 57e25e44d77445aa485045135fda1d2050539222cb520dd32fdfe442f9807f0c
        `),
      );
    });
  });

  describe("hash", () => {
    it("should return the hash of the block", () => {
      // GIVEN
      const block = LKRPBlock.fromHex(cryptoService, mockedBlockHex);
      // WHEN
      const hash = block.hash();
      // THEN
      expect(hash).toBe(
        "7cf783bc15c062242ab92796237da3b192361da7645c488d5023698d4f9cc952",
      );
    });
  });
});
