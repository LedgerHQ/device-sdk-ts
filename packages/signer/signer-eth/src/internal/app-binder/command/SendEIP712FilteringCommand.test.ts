import {
  type ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  Eip712FilterType,
  SendEIP712FilteringCommand,
  type SendEIP712FilteringCommandArgs,
} from "./SendEIP712FilteringCommand";

const ACTIVATE_APDU = Uint8Array.from([0xe0, 0x1e, 0x00, 0x00, 0x00]);
const MESSAGE_INFO_APDU = Uint8Array.from([
  0xe0, 0x1e, 0x00, 0x0f, 0x54, 0x0b, 0x31, 0x69, 0x6e, 0x63, 0x68, 0x20, 0x4f,
  0x72, 0x64, 0x65, 0x72, 0x06, 0x46, 0x30, 0x44, 0x02, 0x20, 0x29, 0x5e, 0x0a,
  0xeb, 0x17, 0xca, 0x09, 0x29, 0xb2, 0xa9, 0x4c, 0x32, 0x4d, 0x67, 0xd0, 0xb5,
  0x52, 0x8a, 0xba, 0x26, 0x81, 0x77, 0xf3, 0xac, 0x29, 0x7b, 0x56, 0x31, 0x41,
  0xe0, 0x00, 0x27, 0x02, 0x20, 0x3a, 0xc3, 0x60, 0xd9, 0xfd, 0x0c, 0x9c, 0x0c,
  0x12, 0x27, 0x9d, 0x1e, 0x73, 0xbe, 0xa5, 0xd5, 0x49, 0xa1, 0xe8, 0x14, 0x1f,
  0x45, 0x4d, 0x88, 0xfb, 0xe1, 0xe8, 0xef, 0x97, 0x0e, 0x68, 0x02,
]);
const RAW_APDU = Uint8Array.from([
  0xe0, 0x1e, 0x00, 0xff, 0x4d, 0x04, 0x46, 0x72, 0x6f, 0x6d, 0x47, 0x30, 0x45,
  0x02, 0x21, 0x00, 0xb8, 0x20, 0xe4, 0xdf, 0xb1, 0xa0, 0xcd, 0xe6, 0xdc, 0x97,
  0xd9, 0xa3, 0x4e, 0xeb, 0xb1, 0xa4, 0xee, 0xf0, 0xb2, 0x26, 0x26, 0x2e, 0x67,
  0x88, 0x11, 0x8a, 0xb3, 0xc7, 0xfb, 0x79, 0xfe, 0x35, 0x02, 0x20, 0x2d, 0x42,
  0x6a, 0x38, 0x8b, 0x4c, 0x3a, 0x80, 0x96, 0xb3, 0xf8, 0x44, 0x12, 0xa7, 0x02,
  0xea, 0x53, 0x77, 0x70, 0xe6, 0x1e, 0xe0, 0x72, 0x7e, 0xc1, 0xb7, 0x10, 0xc1,
  0xda, 0x52, 0x0c, 0x44,
]);
const TOKEN_APDU = Uint8Array.from([
  0xe0, 0x1e, 0x00, 0xfd, 0x49, 0x01, 0x47, 0x30, 0x45, 0x02, 0x21, 0x00, 0xff,
  0x72, 0x78, 0x47, 0x44, 0x54, 0x31, 0xe5, 0x71, 0xcd, 0x2a, 0x0d, 0x9d, 0xb4,
  0x2a, 0x7e, 0xb6, 0x2e, 0x37, 0x87, 0x7b, 0x9b, 0xf2, 0x0e, 0x6a, 0x96, 0x58,
  0x42, 0x55, 0x34, 0x7e, 0x19, 0x02, 0x20, 0x0a, 0x6e, 0x95, 0xb7, 0xf8, 0xe6,
  0x3b, 0x2f, 0xab, 0x0b, 0xef, 0x88, 0xc7, 0x47, 0xde, 0x6a, 0x38, 0x7d, 0x06,
  0x35, 0x1b, 0xe5, 0xbd, 0xc3, 0x4b, 0x2c, 0x1f, 0x9a, 0xea, 0x6f, 0xdd, 0x28,
]);
const AMOUNT_APDU = Uint8Array.from([
  0xe0, 0x1e, 0x00, 0xfe, 0x59, 0x0f, 0x52, 0x65, 0x63, 0x65, 0x69, 0x76, 0x65,
  0x20, 0x6d, 0x69, 0x6e, 0x69, 0x6d, 0x75, 0x6d, 0x01, 0x47, 0x30, 0x45, 0x02,
  0x21, 0x00, 0xa5, 0x9d, 0xc4, 0x79, 0xa8, 0x38, 0xa8, 0x13, 0x90, 0x9c, 0x14,
  0x0a, 0x15, 0xe6, 0xb6, 0x5b, 0xc5, 0x8c, 0x56, 0x33, 0x28, 0x4b, 0xf9, 0x73,
  0xc4, 0x36, 0xde, 0x5a, 0x59, 0x26, 0x34, 0xe2, 0x02, 0x20, 0x1e, 0x03, 0x8f,
  0xc7, 0x99, 0x5d, 0x93, 0x9f, 0xcc, 0xd5, 0x46, 0xe4, 0xc8, 0x5e, 0x79, 0x3c,
  0x0a, 0xd4, 0x51, 0x21, 0x6e, 0x36, 0xa4, 0xed, 0xfc, 0x7b, 0xce, 0x5b, 0xe2,
  0x78, 0x08, 0xcb,
]);
const TRUSTED_NAME_APDU = Uint8Array.from([
  0xe0, 0x1e, 0x00, 0xfb, 0x56, 0x07, 0x53, 0x70, 0x65, 0x6e, 0x64, 0x65, 0x72,
  0x01, 0x02, 0x03, 0x01, 0x00, 0x02, 0x47, 0x30, 0x45, 0x02, 0x21, 0x00, 0xe8,
  0x47, 0x16, 0x6e, 0x60, 0xf8, 0x51, 0xe3, 0xc8, 0xd1, 0xf4, 0x41, 0x39, 0x81,
  0x18, 0x98, 0xcc, 0xd0, 0xd3, 0xa0, 0x3a, 0xed, 0x6c, 0x77, 0xf8, 0xc3, 0x99,
  0x38, 0x13, 0xf4, 0x79, 0xd2, 0x02, 0x20, 0x31, 0xfe, 0x6b, 0x6a, 0x57, 0x4b,
  0x56, 0xc5, 0x10, 0x40, 0x03, 0xcf, 0x07, 0x90, 0x0d, 0x11, 0xff, 0xaf, 0x30,
  0x3d, 0xc0, 0x16, 0xda, 0x4c, 0x1c, 0x3d, 0x18, 0x46, 0x63, 0xda, 0x8f, 0x6a,
]);
const DATE_TIME_APDU = Uint8Array.from([
  0xe0, 0x1e, 0x00, 0xfc, 0x58, 0x0f, 0x41, 0x70, 0x70, 0x72, 0x6f, 0x76, 0x61,
  0x6c, 0x20, 0x65, 0x78, 0x70, 0x69, 0x72, 0x65, 0x47, 0x30, 0x45, 0x02, 0x21,
  0x00, 0xe8, 0x47, 0x16, 0x6e, 0x60, 0xf8, 0x51, 0xe3, 0xc8, 0xd1, 0xf4, 0x41,
  0x39, 0x81, 0x18, 0x98, 0xcc, 0xd0, 0xd3, 0xa0, 0x3a, 0xed, 0x6c, 0x77, 0xf8,
  0xc3, 0x99, 0x38, 0x13, 0xf4, 0x79, 0xd2, 0x02, 0x20, 0x31, 0xfe, 0x6b, 0x6a,
  0x57, 0x4b, 0x56, 0xc5, 0x10, 0x40, 0x03, 0xcf, 0x07, 0x90, 0x0d, 0x11, 0xff,
  0xaf, 0x30, 0x3d, 0xc0, 0x16, 0xda, 0x4c, 0x1c, 0x3d, 0x18, 0x46, 0x63, 0xda,
  0x8f, 0x6a,
]);
const DISCARDED_PATH_APDU = Uint8Array.from([
  0xe0, 0x1e, 0x00, 0x01, 0x11, 0x10, 0x74, 0x6f, 0x2e, 0x5b, 0x5d, 0x2e, 0x77,
  0x61, 0x6c, 0x6c, 0x65, 0x74, 0x73, 0x2e, 0x5b, 0x5d,
]);

describe("SendEIP712FilteringCommand", () => {
  describe("getApdu", () => {
    it("Activate APDU", () => {
      // GIVEN
      const args: SendEIP712FilteringCommandArgs = {
        type: Eip712FilterType.Activation,
      };
      // WHEN
      const command = new SendEIP712FilteringCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(ACTIVATE_APDU);
    });

    it("Discarded path APDU", () => {
      // GIVEN
      const args: SendEIP712FilteringCommandArgs = {
        type: Eip712FilterType.DiscardedPath,
        path: "to.[].wallets.[]",
      };
      // WHEN
      const command = new SendEIP712FilteringCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(DISCARDED_PATH_APDU);
    });

    it("Message info APDU", () => {
      // GIVEN
      const args: SendEIP712FilteringCommandArgs = {
        type: Eip712FilterType.MessageInfo,
        displayName: "1inch Order",
        filtersCount: 6,
        signature:
          "30440220295e0aeb17ca0929b2a94c324d67d0b5528aba268177f3ac297b563141e0002702203ac360d9fd0c9c0c12279d1e73bea5d549a1e8141f454d88fbe1e8ef970e6802",
      };
      // WHEN
      const command = new SendEIP712FilteringCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(MESSAGE_INFO_APDU);
    });

    it("Raw APDU", () => {
      // GIVEN
      const args: SendEIP712FilteringCommandArgs = {
        type: Eip712FilterType.Raw,
        discarded: false,
        displayName: "From",
        signature:
          "3045022100b820e4dfb1a0cde6dc97d9a34eebb1a4eef0b226262e6788118ab3c7fb79fe3502202d426a388b4c3a8096b3f84412a702ea537770e61ee0727ec1b710c1da520c44",
      };
      // WHEN
      const command = new SendEIP712FilteringCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(RAW_APDU);
    });

    it("Token APDU", () => {
      // GIVEN
      const args: SendEIP712FilteringCommandArgs = {
        type: Eip712FilterType.Token,
        discarded: false,
        tokenIndex: 1,
        signature:
          "3045022100ff727847445431e571cd2a0d9db42a7eb62e37877b9bf20e6a96584255347e1902200a6e95b7f8e63b2fab0bef88c747de6a387d06351be5bdc34b2c1f9aea6fdd28",
      };
      // WHEN
      const command = new SendEIP712FilteringCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(TOKEN_APDU);
    });

    it("Amount APDU", () => {
      // GIVEN
      const args: SendEIP712FilteringCommandArgs = {
        type: Eip712FilterType.Amount,
        discarded: false,
        displayName: "Receive minimum",
        tokenIndex: 1,
        signature:
          "3045022100a59dc479a838a813909c140a15e6b65bc58c5633284bf973c436de5a592634e202201e038fc7995d939fccd546e4c85e793c0ad451216e36a4edfc7bce5be27808cb",
      };
      // WHEN
      const command = new SendEIP712FilteringCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(AMOUNT_APDU);
    });

    it("Date-time APDU", () => {
      // GIVEN
      const args: SendEIP712FilteringCommandArgs = {
        type: Eip712FilterType.Datetime,
        discarded: false,
        displayName: "Approval expire",
        signature:
          "3045022100e847166e60f851e3c8d1f44139811898ccd0d3a03aed6c77f8c3993813f479d2022031fe6b6a574b56c5104003cf07900d11ffaf303dc016da4c1c3d184663da8f6a",
      };
      // WHEN
      const command = new SendEIP712FilteringCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(DATE_TIME_APDU);
    });

    it("Trusted name APDU", () => {
      // GIVEN
      const args: SendEIP712FilteringCommandArgs = {
        type: Eip712FilterType.TrustedName,
        discarded: false,
        displayName: "Spender",
        typesAndSourcesPayload: "010203010002",
        signature:
          "3045022100e847166e60f851e3c8d1f44139811898ccd0d3a03aed6c77f8c3993813f479d2022031fe6b6a574b56c5104003cf07900d11ffaf303dc016da4c1c3d184663da8f6a",
      };
      // WHEN
      const command = new SendEIP712FilteringCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(TRUSTED_NAME_APDU);
    });

    it("Discarded filter", () => {
      // GIVEN
      const args: SendEIP712FilteringCommandArgs = {
        type: Eip712FilterType.Raw,
        discarded: true,
        displayName: "From",
        signature:
          "3045022100b820e4dfb1a0cde6dc97d9a34eebb1a4eef0b226262e6788118ab3c7fb79fe3502202d426a388b4c3a8096b3f84412a702ea537770e61ee0727ec1b710c1da520c44",
      };
      // WHEN
      const command = new SendEIP712FilteringCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([...RAW_APDU.slice(0, 2), 0x01, ...RAW_APDU.slice(3)]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return an error if the response status code is invalid", () => {
      // GIVEN
      const response: ApduResponse = {
        statusCode: Buffer.from([0x6a, 0x80]), // Invalid status code
        data: Buffer.from([]),
      };
      // WHEN
      const command = new SendEIP712FilteringCommand({
        type: Eip712FilterType.Activation,
      });
      // THEN
      const result = command.parseResponse(response);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should parse the response", () => {
      // GIVEN
      const response: ApduResponse = {
        statusCode: Buffer.from([0x90, 0x00]), // Success status code
        data: Buffer.from([]),
      };
      // WHEN
      const command = new SendEIP712FilteringCommand({
        type: Eip712FilterType.Activation,
      });
      // THEN
      expect(command.parseResponse(response)).toStrictEqual(
        CommandResultFactory({ data: undefined }),
      );
    });
  });
});
