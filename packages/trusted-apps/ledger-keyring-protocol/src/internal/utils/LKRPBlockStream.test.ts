import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { Just, Left, Right } from "purify-ts";

import { NobleCryptoService } from "@api/crypto/noble/NobleCryptoService";
import { LKRPParsingError } from "@api/model/Errors";
import { CommandTags } from "@internal/models/Tags";

import { LKRPBlock } from "./LKRPBlock";
import { LKRPBlockStream } from "./LKRPBlockStream";
import { LKRPCommand } from "./LKRPCommand";
import { noWS, unIndent } from "./testUtils";

describe("LKRPBlockStream", () => {
  const cryptoService = new NobleCryptoService();

  describe("toString", () => {
    it("should return the hex representation of the block stream", () => {
      // WHEN
      const hex = "0102030405060708";
      const stream = LKRPBlockStream.fromHex(cryptoService, hex);
      // THEN
      expect(stream.toString()).toBe(hex);
    });
  });

  describe("toU8A", () => {
    it("should return the bytes of the block stream", () => {
      // WHEN
      const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const stream = new LKRPBlockStream(cryptoService, bytes);
      // THEN
      expect(stream.toU8A()).toBe(bytes);
    });
  });

  describe("toHuman", () => {
    it("should return a human-readable representation of the block stream", async () => {
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

        01 01 01
        02 20 4e 44 60 fc 88 ad fd db c9 79 44 69 e8 71 3e 92 ab 8a 09 6c 41 ee d5 d7 f7 c2 e3 9a 8c ef bd fb
        06 21 03 92 b7 60 e4 5b 36 4f 82 1e 59 80 82 27 46 63 a6 48 ad 65 35 8f 02 83 60 8d f3 7f 8b bf 50 fc 4d
        01 01 02
        11 2f
          04 04 30 33 33 34
          06 21 03 34 24 8a 3c a1 a0 50 99 56 1a 02 1e 0c 15 1e ad b9 9f 37 6b 62 85 92 b8 72 85 59 c5 d0 63 f4 8a
          01 04 ff ff ff ff
        12 aa
          05 10 8c bc 4d c2 5d 27 e9 f8 fd a6 f1 f7 88 45 59 c0
          05 50 3b 87 47 78 55 50 c5 98 82 a8 40 c8 e1 bb 42 8e e5 ad 69 40 42 79 87 30 45 5e 91 f4 82 2e e5 54 ca 62 ea 77 72 3f 98 ae 3a 8d 27 b1 84 b0 f2 85 16 17 94 4e bc 20 bb 1e ab 4e 5e 83 61 d4 83 d0 d3 6a 92 9d a4 bb 1b b1 1b 34 aa 43 f6 28 51 82
          06 21 03 34 24 8a 3c a1 a0 50 99 56 1a 02 1e 0c 15 1e ad b9 9f 37 6b 62 85 92 b8 72 85 59 c5 d0 63 f4 8a
          06 21 03 0d 7b a2 9e ac 23 b1 eb 0b bd 25 55 23 ee 27 7f 3b f4 78 3f 0e 52 70 4a 3c 23 e0 d7 7d 84 6d 7f
        03 47 30 45 02 21 00 f1 be 95 78 62 14 0f 89 8b db 59 28 fc d5 87 3d 3b d1 39 8b 48 e6 4a 23 16 4b ee ed 76 22 75 8b 02 20 03 c7 6d a5 10 23 4f 12 97 84 18 4b af 8e da 3d 3c 46 14 bf b5 0a 1e 2e 63 34 b4 a7 0a c9 25 c5 
      `;
      const stream = LKRPBlockStream.fromHex(cryptoService, hex);

      // WHEN
      const humanReadable = stream.toHuman();

      // THEN
      expect(await humanReadable).toStrictEqual(
        Right(unIndent`
          (parsed: true, isValid: true):
            Block 0 (isVerified: true, Hash: 4e4460fc88adfddbc9794469e8713e92ab8a096c41eed5d7f7c2e39a8cefbdfb)
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

            Block 1 (isVerified: true, Hash: 852d27b1d0465e8870036e8b9cf2e4159f1c3502136dc560ef094baa41b77f41)
              Hex: 01010102204e4460fc88adfddbc9794469e8713e92ab8a096c41eed5d7f7c2e39a8cefbdfb06210392b760e45b364f821e598082274663a648ad65358f0283608df37f8bbf50fc4d010102112f04043033333406210334248a3ca1a05099561a021e0c151eadb99f376b628592b8728559c5d063f48a0104ffffffff12aa05108cbc4dc25d27e9f8fda6f1f7884559c005503b8747785550c59882a840c8e1bb428ee5ad694042798730455e91f4822ee554ca62ea77723f98ae3a8d27b184b0f2851617944ebc20bb1eab4e5e8361d483d0d36a929da4bb1bb11b34aa43f628518206210334248a3ca1a05099561a021e0c151eadb99f376b628592b8728559c5d063f48a0621030d7ba29eac23b1eb0bbd255523ee277f3bf4783f0e52704a3c23e0d77d846d7f03473045022100f1be957862140f898bdb5928fcd5873d3bd1398b48e64a23164beeed7622758b022003c76da510234f129784184baf8eda3d3c4614bfb50a1e2e6334b4a70ac925c5
              data:
                Parent(32): 4e4460fc88adfddbc9794469e8713e92ab8a096c41eed5d7f7c2e39a8cefbdfb
                Issuer(33): 0392b760e45b364f821e598082274663a648ad65358f0283608df37f8bbf50fc4d
                Commands(2):
                  AddMember(0x11):
                    name: "0334"
                    publicKey(33): 0334248a3ca1a05099561a021e0c151eadb99f376b628592b8728559c5d063f48a
                    permissions(4): 0xffffffff
                  PublishKey(0x12):
                    initializationVector(16): 8cbc4dc25d27e9f8fda6f1f7884559c0
                    encryptedXpriv(80): 3b8747785550c59882a840c8e1bb428ee5ad694042798730455e91f4822ee554ca62ea77723f98ae3a8d27b184b0f2851617944ebc20bb1eab4e5e8361d483d0d36a929da4bb1bb11b34aa43f6285182
                    recipient(33): 0334248a3ca1a05099561a021e0c151eadb99f376b628592b8728559c5d063f48a
                    ephemeralPublicKey(33): 030d7ba29eac23b1eb0bbd255523ee277f3bf4783f0e52704a3c23e0d77d846d7f
                Signature
                  0x30(69)
                  0x02(33): f1be957862140f898bdb5928fcd5873d3bd1398b48e64a23164beeed7622758b
                  0x02(32): 03c76da510234f129784184baf8eda3d3c4614bfb50a1e2e6334b4a70ac925c5
        `),
      );
    });
  });

  describe("parse", () => {
    it("should parse the block stream correctly", () => {
      // GIVEN
      const stream = LKRPBlockStream.fromHex(cryptoService, mockedHex);
      const serializeBlocks = (blocks: LKRPBlock[]) =>
        blocks.map((block) => block.toString());

      // WHEN
      const parsedBlocks = stream.parse();

      // THEN
      expect(parsedBlocks.map(serializeBlocks)).toStrictEqual(
        Right([
          LKRPBlock.fromData(cryptoService, mockedBlockData1),
          LKRPBlock.fromData(cryptoService, mockedBlockData2),
        ]).map(serializeBlocks),
      );
    });

    it("should fail if the block stream data is invalid", () => {
      // GIVEN
      const invalidStream = LKRPBlockStream.fromHex(cryptoService, "00");
      // WHEN
      const parsedData = invalidStream.parse();

      // THEN
      expect(parsedData).toStrictEqual(
        Left(new LKRPParsingError("Invalid end of TLV, expected length")),
      );
    });
  });

  describe("fromData", () => {
    it("should create a BlockStream from data", () => {
      // GIVEN
      const mockedBlockData = [
        { ...mockedBlockData1, parent: undefined },
        { ...mockedBlockData2, parent: undefined },
      ];

      // WHEN
      const stream = LKRPBlockStream.fromData(
        cryptoService,
        mockedBlockData,
        mockedBlockData1.parent,
      );

      // THEN
      expect(stream.toString()).toBe(mockedHex);
    });

    it("should assign a random parent hash if not provided", () => {
      // GIVEN
      const mockedBlockData = [
        { ...mockedBlockData1, parent: undefined },
        { ...mockedBlockData2, parent: undefined },
      ];
      // WHEN
      const stream = LKRPBlockStream.fromData(cryptoService, mockedBlockData);
      const hash = stream
        .parse()
        .map((blocks) => blocks[0]?.hash())
        .caseOf({ Left: () => undefined, Right: (h) => h });

      // THEN
      expect(typeof hash).toBe("string");
      expect(hash?.length).toBe(64); // 32 bytes in hex
      expect(hash).not.toBe(mockedBlockData1.parent);
    });
  });

  describe("validate", () => {
    it("should validate the block stream", async () => {
      // GIVEN
      const stream = LKRPBlockStream.fromHex(cryptoService, mockedHex);

      // WHEN
      const withParentHash = await stream.validate(mockedBlockData1.parent);
      const withoutParentHash = await stream.validate(mockedBlockData1.parent);

      // THEN
      expect(withParentHash).toBe(true);
      expect(withoutParentHash).toBe(true);
    });

    it("should fail validation if the parent hash does not match", async () => {
      // GIVEN
      const invalidStream = LKRPBlockStream.fromHex(
        cryptoService,
        mockedHex.replace(mockedBlockData2.parent, mockedBlockData1.parent),
      );

      // WHEN
      const wrongBlock1 = await invalidStream.validate("0123455678");
      const wrongBlock2 = await invalidStream.validate();

      // THEN
      expect(wrongBlock1).toBe(false);
      expect(wrongBlock2).toBe(false);
    });
  });

  describe("getPath", () => {
    it("should return the path of the block stream", () => {
      // GIVEN
      const stream = LKRPBlockStream.fromHex(cryptoService, mockedHex);

      // WHEN
      const path = stream.getPath();

      // THEN
      expect(path).toEqual(Just("m/0'/16'/0'"));
    });
  });
});

const mockedHex = `
  01 01 01
  02 20 7b a5 ee fa c6 60 55 47 fc 50 18 8b a7 88 03 11 d3 d1 24 0a 7a e3 2e 6e aa c7 49 94 34 09 1c 45
  06 21 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 21
  01 01 03
    15 b8
      05 0c 80 00 00 00 80 00 00 10 80 00 00 00
      06 21 02 83 9a 28 8f 6a 76 09 0b 64 31 22 81 d2 e7 d6 b0 2c 4d df 64 ed 5e 76 93 47 1b 1b 44 5f 81 95 08
      05 10 a6 6c 5a 44 86 e8 70 28 7c aa 53 bb d6 09 af 00
      05 50 0f 43 34 1d 6f 90 99 a5 18 0f b3 04 a2 88 9b 3b 04 68 f0 5f b0 b9 31 d2 22 11 75 3b 34 11 56 7a bb 21 98 1b 64 26 1e 95 bc d4 4a 35 12 af 7c 87 bb b5 a4 b6 b6 80 c0 3b 5f 09 e8 d9 c5 6a 9c b1 c0 78 89 93 a3 d9 d5 c1 40 a2 46 2c b1 93 0d 19
      06 21 02 fb e2 6c 32 ab 99 1c 1b 10 71 56 e2 2f c1 58 c3 35 e0 ae ed c1 71 38 1c 9d 77 74 3c 66 f4 11 71
    11 37
      04 0c 64 65 62 75 67 2d 64 34 63 36 31 64
      06 21 03 d4 c6 1d da 2a af 76 29 54 fc e9 73 96 d9 be 03 99 e1 dc 75 c3 b7 90 c7 a3 4d de 85 96 a1 18 12
      01 04 ff ff ff ff
    12 aa
      05 10 4d 30 5e ae 5b 70 b6 9c f6 57 f3 b9 f7 db 58 63
      05 50 89 8d e5 35 f8 7f 7a c7 75 b0 9c 80 82 7d 14 ef dd ee aa 9a 2b 10 6b fd 7f cc 91 94 2d c3 6d 6a 17 51 79 3b a7 ec 07 92 ba 93 6f 5f 1d 85 8b c1 fc 54 ca 1a 70 e8 d2 8a 5b 0b f3 3b 5e 92 6f 3a dd 37 2c 80 2b 3b 9d a6 4b c0 6e 26 b9 34 9d b5
      06 21 03 d4 c6 1d da 2a af 76 29 54 fc e9 73 96 d9 be 03 99 e1 dc 75 c3 b7 90 c7 a3 4d de 85 96 a1 18 12
      06 21 02 3d b6 6b 97 4b 87 1c 6c aa fd f4 86 c6 89 55 18 30 3b 14 0d 38 9e 78 7d 2c 3b 55 27 c2 df 50 f4
  03 46 30 44 02 20 56 ab 42 6b d7 56 96 cb e9 53 8c b4 22 71 e8 79 6b a1 57 6d fe 3e 26 34 f0 a6 f1 a6 36 82 1e 50 02 20 5e 41 ae 68 eb d8 fb ff 40 43 40 a4 f0 12 4a f2 5e 94 8a a5 25 00 de 19 2d 15 ff 4f 8e e9 2c 02

  01 01 01
  02 20 15 4d 99 eb 86 7c fe ef 24 9d 57 3f c2 e1 f3 d3 07 c1 e4 9e c1 f6 6e 9a f1 c9 db d2 19 14 32 11 
  06 21 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f 10 11 12 13 14 15 16 17 18 19 1a 1b 1c 1d 1e 1f 20 21
  01 01 02
    11 37
      04 0c 64 65 62 75 67 2d 38 30 61 32 38 39
      06 21 02 80 a2 89 18 36 9e 12 c8 6f eb 32 1c d1 00 fe 6d 95 8e 55 a0 bb 57 05 76 ef 71 8e 7a 37 92 04 db
      01 04 ff ff ff ff
    12 aa
      05 10 27 bd b3 4f b6 02 81 28 bf c9 19 f4 db 7d 13 78
      05 50 e7 92 b8 3f 26 fa c0 de 46 ee 8f 1a 07 e5 3b 0e 50 8d 93 73 aa 2e 80 47 f0 a7 64 20 4a b0 f0 6a 2f ff a9 c2 95 99 f5 d3 fe 42 fe fa bd 98 27 86 71 57 bd 14 ec 7e 2b d8 ef 83 c6 f9 37 1d 7b 48 d2 8d 9a 44 99 f8 ed 62 6c e7 5f ce c0 a0 b3 3f
      06 21 02 80 a2 89 18 36 9e 12 c8 6f eb 32 1c d1 00 fe 6d 95 8e 55 a0 bb 57 05 76 ef 71 8e 7a 37 92 04 db
      06 21 02 7d 40 15 77 37 67 1b b0 4e ac a2 75 6b 8e c5 80 20 ff 5c 89 3b 10 cb fb 25 b4 80 14 c5 25 2d c4
  03 46 30 44 02 20 71 8d 20 c9 99 68 93 63 9d a8 07 b8 a9 67 5d 94 4a bd c8 fd ed 97 f7 31 59 be ba 50 04 fa 17 f1 02 20 33 38 b7 4a 9e 6a 2e 69 6e a3 65 8d 3a f4 fc e9 5f fa 0f 74 c1 1b 2c 3d 37 b0 ca 1b 57 76 57 e8 
`.replace(/\s/g, "");

const mockedBlockData1 = {
  parent: "7ba5eefac6605547fc50188ba7880311d3d1240a7ae32e6eaac7499434091c45",
  issuer: hexaStringToBuffer(
    "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021",
  )!,
  commands: [
    LKRPCommand.fromData({
      type: CommandTags.Derive,
      path: "m/0'/16'/0'",
      groupKey: hexaStringToBuffer(
        "02839a288f6a76090b64312281d2e7d6b02c4ddf64ed5e7693471b1b445f819508",
      )!,
      initializationVector: hexaStringToBuffer(
        "a66c5a4486e870287caa53bbd609af00",
      )!,
      encryptedXpriv: hexaStringToBuffer(
        "0f43341d6f9099a5180fb304a2889b3b0468f05fb0b931d22211753b3411567abb21981b64261e95bcd44a3512af7c87bbb5a4b6b680c03b5f09e8d9c56a9cb1c0788993a3d9d5c140a2462cb1930d19",
      )!,
      ephemeralPublicKey: hexaStringToBuffer(
        "02fbe26c32ab991c1b107156e22fc158c335e0aeedc171381c9d77743c66f41171",
      )!,
    }),
    LKRPCommand.fromData({
      type: CommandTags.AddMember,
      name: "debug-d4c61d",
      publicKey: hexaStringToBuffer(
        "03d4c61dda2aaf762954fce97396d9be0399e1dc75c3b790c7a34dde8596a11812",
      )!,
      permissions: 0xffffffff,
    }),
    LKRPCommand.fromData({
      type: CommandTags.PublishKey,
      initializationVector: hexaStringToBuffer(
        "4d305eae5b70b69cf657f3b9f7db5863",
      )!,
      encryptedXpriv: hexaStringToBuffer(
        "898de535f87f7ac775b09c80827d14efddeeaa9a2b106bfd7fcc91942dc36d6a1751793ba7ec0792ba936f5f1d858bc1fc54ca1a70e8d28a5b0bf33b5e926f3add372c802b3b9da64bc06e26b9349db5",
      )!,
      recipient: hexaStringToBuffer(
        "03d4c61dda2aaf762954fce97396d9be0399e1dc75c3b790c7a34dde8596a11812",
      )!,
      ephemeralPublicKey: hexaStringToBuffer(
        "023db66b974b871c6caafdf486c6895518303b140d389e787d2c3b5527c2df50f4",
      )!,
    }),
  ],
  signature: hexaStringToBuffer(
    "3044022056ab426bd75696cbe9538cb42271e8796ba1576dfe3e2634f0a6f1a636821e5002205e41ae68ebd8fbff404340a4f0124af25e948aa52500de192d15ff4f8ee92c02",
  )!,
};
const mockedBlockData2 = {
  parent: "154d99eb867cfeef249d573fc2e1f3d307c1e49ec1f66e9af1c9dbd219143211",
  issuer: hexaStringToBuffer(
    "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021",
  )!,
  commands: [
    LKRPCommand.fromData({
      type: CommandTags.AddMember,
      name: "debug-80a289",
      publicKey: hexaStringToBuffer(
        "0280a28918369e12c86feb321cd100fe6d958e55a0bb570576ef718e7a379204db",
      )!,
      permissions: 0xffffffff,
    }),
    LKRPCommand.fromData({
      type: CommandTags.PublishKey,
      initializationVector: hexaStringToBuffer(
        "27bdb34fb6028128bfc919f4db7d1378",
      )!,
      encryptedXpriv: hexaStringToBuffer(
        "e792b83f26fac0de46ee8f1a07e53b0e508d9373aa2e8047f0a764204ab0f06a2fffa9c29599f5d3fe42fefabd9827867157bd14ec7e2bd8ef83c6f9371d7b48d28d9a4499f8ed626ce75fcec0a0b33f",
      )!,
      recipient: hexaStringToBuffer(
        "0280a28918369e12c86feb321cd100fe6d958e55a0bb570576ef718e7a379204db",
      )!,
      ephemeralPublicKey: hexaStringToBuffer(
        "027d40157737671bb04eaca2756b8ec58020ff5c893b10cbfb25b48014c5252dc4",
      )!,
    }),
  ],
  signature: hexaStringToBuffer(
    "30440220718d20c9996893639da807b8a9675d944abdc8fded97f73159beba5004fa17f102203338b74a9e6a2e696ea3658d3af4fce95ffa0f74c11b2c3d37b0ca1b577657e8",
  )!,
};
