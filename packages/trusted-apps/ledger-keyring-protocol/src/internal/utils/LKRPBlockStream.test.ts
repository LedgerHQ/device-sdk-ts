import { hexaStringToBuffer } from "@ledgerhq/device-management-kit";
import { Just, Left, Right } from "purify-ts";

import { NobleCryptoService } from "@api/crypto/noble/NobleCryptoService";
import { LKRPParsingError } from "@api/model/Errors";
import { CommandTags } from "@internal/models/Tags";

import { LKRPBlock } from "./LKRPBlock";
import { LKRPBlockStream } from "./LKRPBlockStream";
import { LKRPCommand } from "./LKRPCommand";

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
    it("should return a human-readable representation of the block stream", () => {
      // GIVEN
      const stream = LKRPBlockStream.fromHex(cryptoService, mockedHex);

      // WHEN
      const humanReadable = stream.toHuman();

      // THEN
      expect(humanReadable).toStrictEqual(
        Right(
          [
            "Parent: 7ba5eefac6605547fc50188ba7880311d3d1240a7ae32e6eaac7499434091c45",
            "Issuer: 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021",
            "Commands:",
            "  Derive(0x15):",
            "    path: m/0'/16'/0'",
            "    groupKey: 02839a288f6a76090b64312281d2e7d6b02c4ddf64ed5e7693471b1b445f819508",
            "    initializationVector: a66c5a4486e870287caa53bbd609af00",
            "    encryptedXpriv: 0f43341d6f9099a5180fb304a2889b3b0468f05fb0b931d22211753b3411567abb21981b64261e95bcd44a3512af7c87bbb5a4b6b680c03b5f09e8d9c56a9cb1c0788993a3d9d5c140a2462cb1930d19",
            "    ephemeralPublicKey: 02fbe26c32ab991c1b107156e22fc158c335e0aeedc171381c9d77743c66f41171",
            "  AddMember(0x11):",
            "    name: debug-d4c61d",
            "    publicKey: 03d4c61dda2aaf762954fce97396d9be0399e1dc75c3b790c7a34dde8596a11812",
            "    permissions: 4294967295",
            "  PublishKey(0x12):",
            "    initializationVector: 4d305eae5b70b69cf657f3b9f7db5863",
            "    encryptedXpriv: 898de535f87f7ac775b09c80827d14efddeeaa9a2b106bfd7fcc91942dc36d6a1751793ba7ec0792ba936f5f1d858bc1fc54ca1a70e8d28a5b0bf33b5e926f3add372c802b3b9da64bc06e26b9349db5",
            "    recipient: 03d4c61dda2aaf762954fce97396d9be0399e1dc75c3b790c7a34dde8596a11812",
            "    ephemeralPublicKey: 023db66b974b871c6caafdf486c6895518303b140d389e787d2c3b5527c2df50f4",
            "Signature: 3044022056ab426bd75696cbe9538cb42271e8796ba1576dfe3e2634f0a6f1a636821e5002205e41ae68ebd8fbff404340a4f0124af25e948aa52500de192d15ff4f8ee92c02",
            "",
            "Parent: 154d99eb867cfeef249d573fc2e1f3d307c1e49ec1f66e9af1c9dbd219143211",
            "Issuer: 0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2021",
            "Commands:",
            "  AddMember(0x11):",
            "    name: debug-80a289",
            "    publicKey: 0280a28918369e12c86feb321cd100fe6d958e55a0bb570576ef718e7a379204db",
            "    permissions: 4294967295",
            "  PublishKey(0x12):",
            "    initializationVector: 27bdb34fb6028128bfc919f4db7d1378",
            "    encryptedXpriv: e792b83f26fac0de46ee8f1a07e53b0e508d9373aa2e8047f0a764204ab0f06a2fffa9c29599f5d3fe42fefabd9827867157bd14ec7e2bd8ef83c6f9371d7b48d28d9a4499f8ed626ce75fcec0a0b33f",
            "    recipient: 0280a28918369e12c86feb321cd100fe6d958e55a0bb570576ef718e7a379204db",
            "    ephemeralPublicKey: 027d40157737671bb04eaca2756b8ec58020ff5c893b10cbfb25b48014c5252dc4",
            "Signature: 30440220718d20c9996893639da807b8a9675d944abdc8fded97f73159beba5004fa17f102203338b74a9e6a2e696ea3658d3af4fce95ffa0f74c11b2c3d37b0ca1b577657e8",
          ].join("\n"),
        ),
      );
    });
  });

  describe("parse", () => {
    it("should parse the block stream correctly", () => {
      // GIVEN
      const stream = LKRPBlockStream.fromHex(cryptoService, mockedHex);

      // WHEN
      const parsedData = stream.parse();
      stream.toHuman(); // Run toHuman to force the parsing of the commands

      // THEN
      expect(parsedData).toStrictEqual(
        Right([
          LKRPBlock.fromData(cryptoService, mockedBlockData1),
          LKRPBlock.fromData(cryptoService, mockedBlockData2),
        ]),
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
