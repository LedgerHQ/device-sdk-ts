import {
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-sdk-core";

import {
  ProvideNFTInformationCommand,
  ProvideNFTInformationCommandArgs,
} from "./ProvideNFTInformationCommand";

const NFT_INFORMATION_PAYLOAD =
  "0101084d6574614d6f6a61c5b07a55501014f36ec5d39d950a321439f6dd7600000000000000010101473045022100d5f96cad91b83da224c94945e4c8aeb54f089f52c87302af54f0b6b74159f76a02201a1204a36b15f2ff31149fd05502ad65ee98fe77f30a3c8d9b32eb6cf08cabea";

const NFT_INFORMATION_APDU = Uint8Array.from([
  0xe0, 0x14, 0x00, 0x00, 0x71, 0x01, 0x01, 0x08, 0x4d, 0x65, 0x74, 0x61, 0x4d,
  0x6f, 0x6a, 0x61, 0xc5, 0xb0, 0x7a, 0x55, 0x50, 0x10, 0x14, 0xf3, 0x6e, 0xc5,
  0xd3, 0x9d, 0x95, 0x0a, 0x32, 0x14, 0x39, 0xf6, 0xdd, 0x76, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x01, 0x01, 0x47, 0x30, 0x45, 0x02, 0x21, 0x00,
  0xd5, 0xf9, 0x6c, 0xad, 0x91, 0xb8, 0x3d, 0xa2, 0x24, 0xc9, 0x49, 0x45, 0xe4,
  0xc8, 0xae, 0xb5, 0x4f, 0x08, 0x9f, 0x52, 0xc8, 0x73, 0x02, 0xaf, 0x54, 0xf0,
  0xb6, 0xb7, 0x41, 0x59, 0xf7, 0x6a, 0x02, 0x20, 0x1a, 0x12, 0x04, 0xa3, 0x6b,
  0x15, 0xf2, 0xff, 0x31, 0x14, 0x9f, 0xd0, 0x55, 0x02, 0xad, 0x65, 0xee, 0x98,
  0xfe, 0x77, 0xf3, 0x0a, 0x3c, 0x8d, 0x9b, 0x32, 0xeb, 0x6c, 0xf0, 0x8c, 0xab,
  0xea,
]);

describe("ProvideNFTInformationCommand", () => {
  describe("getApdu", () => {
    it("should return the raw APDU", () => {
      // GIVEN
      const args: ProvideNFTInformationCommandArgs = {
        data: NFT_INFORMATION_PAYLOAD,
      };
      // WHEN
      const command = new ProvideNFTInformationCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(NFT_INFORMATION_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should return an error if the response status code is invalid", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x6d, 0x00]), // Invalid status code
      };
      // WHEN
      const command = new ProvideNFTInformationCommand({ data: "" });
      const result = command.parseResponse(response);
      // THEN
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should not throw if the response status code is correct", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x90, 0x00]), // Success status code
      };
      // WHEN
      const command = new ProvideNFTInformationCommand({ data: "" });
      const result = command.parseResponse(response);
      // THEN
      expect(isSuccessCommandResult(result)).toBe(true);
    });
  });
});
