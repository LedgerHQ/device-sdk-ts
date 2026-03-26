import {
  ApduResponse,
  CommandResultFactory,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import {
  GetTrustedInputCommand,
  type GetTrustedInputCommandArgs,
} from "./GetTrustedInputCommand";

describe("GetTrustedInputCommand", () => {
  const transaction = new Uint8Array([0xaa, 0xbb, 0xcc]);
  const defaultArgs: GetTrustedInputCommandArgs = {
    transaction,
  };
  let command: GetTrustedInputCommand;

  beforeEach(() => {
    command = new GetTrustedInputCommand(defaultArgs);
  });

  describe("name", () => {
    it("should be 'GetTrustedInput'", () => {
      expect(command.name).toBe("GetTrustedInput");
    });
  });

  describe("getApdu", () => {
    it("should build APDU with P2.NEXT when indexLookup is not provided", () => {
      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toEqual(
        new Uint8Array([
          0xe0, // CLA
          0x42, // INS.GET_TRUSTED_INPUT
          0x01, // P1.CHECK_ON_DEVICE
          0x80, // P2.NEXT
          0x03, // data length
          0xaa,
          0xbb,
          0xcc,
        ]),
      );
    });

    it("should prefix indexLookup and use P2.FIRST when indexLookup is provided", () => {
      command = new GetTrustedInputCommand({
        transaction,
        indexLookup: 5,
      });

      const apdu = command.getApdu();

      expect(apdu.getRawApdu()).toEqual(
        new Uint8Array([
          0xe0, // CLA
          0x42, // INS.GET_TRUSTED_INPUT
          0x01, // P1.CHECK_ON_DEVICE
          0x00, // P2.FIRST
          0x07, // data length (4-byte prefix + 3-byte transaction)
          0x00,
          0x00,
          0x00,
          0x05, // indexLookup = 5 (big-endian)
          0xaa,
          0xbb,
          0xcc,
        ]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return success result with APDU response on status 0x9000", () => {
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array([0x01, 0x02]),
      });

      const response = command.parseResponse(apduResponse);

      expect(response).toEqual(CommandResultFactory({ data: apduResponse }));
    });

    it("should return a mapped command error on app error status", () => {
      const apduResponse = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x85]),
        data: new Uint8Array([]),
      });

      const response = command.parseResponse(apduResponse);

      expect(isSuccessCommandResult(response)).toBe(false);
      if (!isSuccessCommandResult(response)) {
        const error = response.error as { errorCode?: string; message: string };
        expect(error.errorCode).toBe("6985");
        expect(error.message).toBe("Rejected by the user");
      }
    });
  });
});
