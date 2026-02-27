import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  SendCertificateCommand,
  type SendCertificateCommandArgs,
} from "./SendCertificateCommand";

describe("SendCertificateCommand", () => {
  const defaultArgs: SendCertificateCommandArgs = {
    certificate: new Uint8Array([0x01, 0x02, 0x03]),
  };
  let command: SendCertificateCommand;

  beforeEach(() => {
    command = new SendCertificateCommand(defaultArgs);
  });

  describe("name", () => {
    it("should be 'SendCertificate'", () => {
      expect(command.name).toBe("SendCertificate");
    });
  });

  describe("getApdu", () => {
    it("should return the correct APDU with certificate in data", () => {
      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.data).toStrictEqual(defaultArgs.certificate);
      expect(apdu.cla).toBe(0xb0);
      expect(apdu.ins).toBe(0x06);
      expect(apdu.p1).toBe(0x00);
      expect(apdu.p2).toBe(0x00);
    });
  });

  describe("parseResponse", () => {
    it("should return success when status is 0x9000 and no data", () => {
      const LNX_RESPONSE_GOOD = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: new Uint8Array(),
      };

      const parsed = command.parseResponse(LNX_RESPONSE_GOOD);
      expect(parsed).toStrictEqual(CommandResultFactory({ data: undefined }));
      expect(isSuccessCommandResult(parsed)).toBe(true);
    });

    it("should return an error if the status code is not 0x9000", () => {
      const LNX_RESPONSE_ERROR = {
        statusCode: Uint8Array.from([0x6a, 0x80]),
        data: new Uint8Array(),
      };

      const result = command.parseResponse(LNX_RESPONSE_ERROR);
      expect(isSuccessCommandResult(result)).toBe(false);
    });

    it("should return an error if response contains unexpected data", () => {
      const LNX_RESPONSE_EXTRA = {
        statusCode: Uint8Array.from([0x90, 0x00]),
        data: Uint8Array.from([0x01]),
      };

      const result = command.parseResponse(LNX_RESPONSE_EXTRA);
      expect(isSuccessCommandResult(result)).toBe(false);
      // @ts-expect-error response is not typed
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    });
  });
});
