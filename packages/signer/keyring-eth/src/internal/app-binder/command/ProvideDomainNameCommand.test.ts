import {
  ApduResponse,
  InvalidStatusWordError,
} from "@ledgerhq/device-sdk-core";

import {
  ProvideDomainNameCommand,
  ProvideDomainNameCommandArgs,
} from "./ProvideDomainNameCommand";

const FIRST_CHUNK_APDU = Uint8Array.from([
  0xe0, 0x22, 0x01, 0x00, 0x08, 0x00, 0x06, 0x4c, 0x65, 0x64, 0x67, 0x65, 0x72,
]);

describe("ProvideDomainNameCommand", () => {
  describe("getApdu", () => {
    it("should return the raw APDU", () => {
      // GIVEN
      const args: ProvideDomainNameCommandArgs = {
        data: "00064C6564676572",
        index: 0,
      };
      // WHEN
      const command = new ProvideDomainNameCommand(args);
      const apdu = command.getApdu();
      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(FIRST_CHUNK_APDU);
    });
  });

  describe("parseResponse", () => {
    it("should throw an error if the response status code is invalid", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x6a, 0x80]), // Invalid status code
      };
      // WHEN
      const command = new ProvideDomainNameCommand({
        data: "",
        index: 0,
      });
      // THEN
      expect(() => command.parseResponse(response)).toThrow(
        InvalidStatusWordError,
      );
    });

    it("should not throw if the response status code is correct", () => {
      // GIVEN
      const response: ApduResponse = {
        data: Buffer.from([]),
        statusCode: Buffer.from([0x90, 0x00]), // Success status code
      };
      // WHEN
      const command = new ProvideDomainNameCommand({
        data: "",
        index: 0,
      });
      // THEN
      expect(() => command.parseResponse(response)).not.toThrow();
    });
  });
});
