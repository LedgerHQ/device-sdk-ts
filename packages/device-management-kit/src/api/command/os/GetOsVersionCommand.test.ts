import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";

import { GetOsVersionCommand } from "./GetOsVersionCommand";

const GET_OS_VERSION_APDU = Uint8Array.from([0xe0, 0x01, 0x00, 0x00, 0x00]);

const LNX_RESPONSE_DATA_GOOD = Uint8Array.from([
  0x33, 0x00, 0x00, 0x04, 0x05, 0x32, 0x2e, 0x32, 0x2e, 0x33, 0x04, 0xe6, 0x00,
  0x00, 0x00, 0x04, 0x32, 0x2e, 0x33, 0x30, 0x04, 0x31, 0x2e, 0x31, 0x36, 0x01,
  0x00, 0x01, 0x00, 0x01, 0x00, 0x90, 0x00,
]);
const LNX_RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: LNX_RESPONSE_DATA_GOOD,
});

const LNSP_REPONSE_DATA_GOOD = Uint8Array.from([
  0x33, 0x10, 0x00, 0x04, 0x05, 0x31, 0x2e, 0x31, 0x2e, 0x31, 0x04, 0xe6, 0x00,
  0x00, 0x00, 0x04, 0x34, 0x2e, 0x30, 0x33, 0x04, 0x33, 0x2e, 0x31, 0x32, 0x01,
  0x00, 0x01, 0x00, 0x90, 0x00,
]);
const LNSP_RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: LNSP_REPONSE_DATA_GOOD,
});

const STAX_RESPONSE_DATA_GOOD = Uint8Array.from([
  0x33, 0x20, 0x00, 0x04, 0x05, 0x31, 0x2e, 0x33, 0x2e, 0x30, 0x04, 0xe6, 0x00,
  0x00, 0x00, 0x04, 0x35, 0x2e, 0x32, 0x34, 0x04, 0x30, 0x2e, 0x34, 0x38, 0x01,
  0x00, 0x01, 0x00, 0x90, 0x00,
]);
const STAX_RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: STAX_RESPONSE_DATA_GOOD,
});

describe("GetOsVersionCommand", () => {
  let command: GetOsVersionCommand;

  beforeEach(() => {
    command = new GetOsVersionCommand();
  });

  describe("getApdu", () => {
    it("should return the GetOsVersion apdu", () => {
      const apdu = command.getApdu();
      expect(apdu.getRawApdu()).toStrictEqual(GET_OS_VERSION_APDU);
    });
  });

  describe("parseResponse", () => {
    describe("Nano X", () => {
      it("should parse the LNX response", () => {
        const parsed = command.parseResponse(
          LNX_RESPONSE_GOOD,
          DeviceModelId.NANO_X,
        );

        const expected = CommandResultFactory({
          data: {
            targetId: "33000004",
            seVersion: "2.2.3",
            seFlags: 3858759680,
            mcuSephVersion: "2.30",
            mcuBootloaderVersion: "1.16",
            hwVersion: "00",
            langId: "00",
            recoverState: "00",
          },
        });

        expect(parsed).toStrictEqual(expected);
      });
    });

    describe("Nano S Plus", () => {
      it("should parse the LNSP response", () => {
        const parsed = command.parseResponse(
          LNSP_RESPONSE_GOOD,
          DeviceModelId.NANO_SP,
        );

        const expected = CommandResultFactory({
          data: {
            targetId: "33100004",
            seVersion: "1.1.1",
            seFlags: 3858759680,
            mcuSephVersion: "4.03",
            mcuBootloaderVersion: "3.12",
            hwVersion: "00",
            langId: "00",
            recoverState: "00",
          },
        });

        expect(parsed).toStrictEqual(expected);
      });
    });

    describe("Stax", () => {
      it("should parse the STAX response", () => {
        const parsed = command.parseResponse(
          STAX_RESPONSE_GOOD,
          DeviceModelId.STAX,
        );

        const expected = CommandResultFactory({
          data: {
            targetId: "33200004",
            seVersion: "1.3.0",
            seFlags: 3858759680,
            mcuSephVersion: "5.24",
            mcuBootloaderVersion: "0.48",
            hwVersion: "00",
            langId: "00",
            recoverState: "00",
          },
        });

        expect(parsed).toStrictEqual(expected);
      });
    });

    describe("Error handling", () => {
      it("should return an error if the response is not successful", () => {
        const response = new ApduResponse({
          statusCode: Uint8Array.from([0x6e, 0x80]),
          data: Uint8Array.from([]),
        });
        const result = command.parseResponse(response, DeviceModelId.NANO_S);

        expect(isSuccessCommandResult(result)).toBeFalsy();
      });
    });
  });
});
