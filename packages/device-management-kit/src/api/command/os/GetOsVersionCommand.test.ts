import {
  CommandResultFactory,
  isSuccessCommandResult,
} from "@api/command/model/CommandResult";
import { DeviceModelId } from "@api/device/DeviceModel";
import { ApduResponse } from "@api/device-session/ApduResponse";

import { getOsVersionCommandResponseMockBuilder } from "./__mocks__/GetOsVersionCommand";
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

const BL_RESPONSE_DATA_GOOD = Uint8Array.from([
  0x05, 0x01, 0x00, 0x03, 0x04, 0x31, 0x2e, 0x31, 0x36, 0x04, 0xf4, 0xd8, 0xaa,
  0x43, 0x05, 0x32, 0x2e, 0x32, 0x2e, 0x33, 0x04, 0x33, 0x00, 0x00, 0x04, 0x90,
  0x00,
]);
const BL_RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: BL_RESPONSE_DATA_GOOD,
});

const OLD_FM_RESPONSE_DATA_GOOD = Uint8Array.from([
  0x33, 0x00, 0x00, 0x04, 0x00, 0x04, 0xee, 0x00, 0x00, 0x00, 0x04, 0x32, 0x2e,
  0x33, 0x30, 0x01, 0x01, 0x01, 0x00, 0x01, 0x00, 0x90, 0x00,
]);
const OLD_FM_RESPONSE_GOOD = new ApduResponse({
  statusCode: Uint8Array.from([0x90, 0x00]),
  data: OLD_FM_RESPONSE_DATA_GOOD,
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
          data: getOsVersionCommandResponseMockBuilder(DeviceModelId.NANO_X),
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
          data: getOsVersionCommandResponseMockBuilder(DeviceModelId.NANO_SP),
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
          data: getOsVersionCommandResponseMockBuilder(DeviceModelId.STAX),
        });

        expect(parsed).toStrictEqual(expected);
      });
    });

    describe("Bootloader", () => {
      it("should parse the bootloader response", () => {
        const parsed = command.parseResponse(
          BL_RESPONSE_GOOD,
          DeviceModelId.STAX,
        );

        const expected = CommandResultFactory({
          data: {
            isBootloader: true,
            isOsu: false,
            targetId: 83951619,
            seTargetId: 855638020,
            seVersion: "2.2.3",
            seFlags: new Uint8Array([0xf4, 0xd8, 0xaa, 0x43]),
            mcuTargetId: 83951619,
            mcuSephVersion: "",
            mcuBootloaderVersion: "1.16",
            hwVersion: "",
            langId: undefined,
            recoverState: undefined,
            secureElementFlags: {
              isPinValidated: true,
              hasMcuSerialNumber: true,
              hasValidCertificate: true,
              isCustomAuthorityConnectionAllowed: true,
              isSecureConnectionAllowed: false,
              isOnboarded: true,
              isMcuCodeSigned: false,
              isInRecoveryMode: false,
            },
          },
        });

        expect(parsed).toStrictEqual(expected);
      });
    });

    describe("Old firmware", () => {
      it("should parse the old firmware response", () => {
        const parsed = command.parseResponse(
          OLD_FM_RESPONSE_GOOD,
          DeviceModelId.NANO_X,
        );

        const expected = CommandResultFactory({
          data: {
            isBootloader: false,
            isOsu: false,
            targetId: 855638020,
            seTargetId: 855638020,
            seVersion: "0.0.0",
            seFlags: new Uint8Array(),
            mcuTargetId: undefined,
            mcuSephVersion: "2.30",
            mcuBootloaderVersion: "",
            hwVersion: "00",
            langId: undefined,
            recoverState: undefined,
            secureElementFlags: {
              isPinValidated: true,
              hasMcuSerialNumber: true,
              hasValidCertificate: true,
              isCustomAuthorityConnectionAllowed: false,
              isSecureConnectionAllowed: true,
              isOnboarded: true,
              isMcuCodeSigned: true,
              isInRecoveryMode: false,
            },
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
