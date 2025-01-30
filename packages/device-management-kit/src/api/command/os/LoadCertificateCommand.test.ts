import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import {
  LoadCertificateCommand,
  LoadCertificateCommandError,
} from "@api/command/os/LoadCertificateCommand";
import { GlobalCommandError } from "@api/command/utils/GlobalCommandError";
import { hexaStringToBuffer } from "@api/utils/HexaString";

describe("LoadCertificateCommand", () => {
  describe("getApdu", () => {
    it("should return the APDU with key equal to 1", () => {
      // GIVEN
      const args = {
        keyUsage: 0x42,
        certificate: new Uint8Array([0x01, 0x02, 0x03]),
      };
      const command = new LoadCertificateCommand(args);

      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.cla).toBe(0xb0);
      expect(apdu.ins).toBe(0x06);
      expect(apdu.p1).toBe(0x42);
      expect(apdu.p2).toBe(0x00);
      expect(apdu.data).toStrictEqual(new Uint8Array([0x01, 0x02, 0x03]));
    });
  });

  describe("parseResponse", () => {
    let command: LoadCertificateCommand;

    beforeEach(() => {
      command = new LoadCertificateCommand({
        keyUsage: 0x01,
        certificate: new Uint8Array(),
      });
    });

    it("should return success if the response status code is success", () => {
      // GIVEN
      const response = {
        statusCode: new Uint8Array([0x90, 0x00]),
        data: new Uint8Array(),
      };

      // WHEN
      const result = command.parseResponse(response);

      // THEN
      expect(result).toStrictEqual(CommandResultFactory({ data: undefined }));
    });

    describe("errors", () => {
      it("should return error command result if the device is locked", () => {
        // GIVEN
        const response = {
          statusCode: new Uint8Array([0x55, 0x15]),
          data: new Uint8Array(),
        };

        // WHEN
        const result = command.parseResponse(response);

        // THEN
        if (isSuccessCommandResult(result)) {
          fail("Expected error command result");
        } else {
          expect(result.error).toBeInstanceOf(GlobalCommandError);
        }
      });

      it.each([
        "422f",
        "4230",
        "4231",
        "4232",
        "4233",
        "4234",
        "4235",
        "4236",
        "4237",
        "4238",
        "4239",
        "422d",
        "3301",
        "422e",
        "5720",
        "4118",
        "ffff",
      ])(
        "should return a ProvidePkiCertificateCommandError if the response is a %s specific error code",
        (errorCode) => {
          // GIVEN
          const response = {
            statusCode: hexaStringToBuffer(errorCode)!,
            data: new Uint8Array(),
          };

          // WHEN
          const result = command.parseResponse(response);

          // THEN
          if (isSuccessCommandResult(result)) {
            fail("Expected error command result");
          } else {
            expect(result.error).toBeInstanceOf(LoadCertificateCommandError);
            // @ts-ignore
            expect(result.error.errorCode).toBe(errorCode);
          }
        },
      );
    });
  });
});
