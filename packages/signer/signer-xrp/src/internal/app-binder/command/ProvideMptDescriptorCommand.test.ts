import {
  ApduResponse,
  hexaStringToBuffer,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { ProvideMptDescriptorCommand } from "@internal/app-binder/command/ProvideMptDescriptorCommand";
import { type XrpAppCommandError } from "@internal/app-binder/command/utils/xrpApplicationErrors";

// USDX, scale 2, issuance 000000050511E17DB83BB6F113939D67BC8EA539EDC926FC,
// signed by the Ragger test key
const DESCRIPTOR = hexaStringToBuffer(
  "0101900201010304800000900403585250050455534458060102071A1018000000050511E17DB83BB6F113939D67BC8EA539EDC926FC" +
    "084630440220377F1F63363A4F89ABF9DCF80A01054408B926A4D823B71314086A2513827FA602207D54ED5118F5722637D31E9641D714D72D8FA8DBD7ECF54C23253A1227A11E0E",
)!;

const response = (sw: [number, number]) =>
  new ApduResponse({
    statusCode: Uint8Array.from(sw),
    data: new Uint8Array(0),
  });

describe("ProvideMptDescriptorCommand", () => {
  let command: ProvideMptDescriptorCommand;

  beforeEach(() => {
    command = new ProvideMptDescriptorCommand({ descriptor: DESCRIPTOR });
  });

  describe("name", () => {
    it("should be 'ProvideMptDescriptor'", () => {
      expect(command.name).toBe("ProvideMptDescriptor");
    });
  });

  describe("getApdu", () => {
    it("should send the descriptor in one APDU", () => {
      // WHEN
      const apdu = command.getApdu();

      // THEN
      expect(apdu.getRawApdu()).toStrictEqual(
        Uint8Array.from([
          0xe0,
          0x22,
          0x00,
          0x00,
          DESCRIPTOR.length,
          ...DESCRIPTOR,
        ]),
      );
    });
  });

  describe("parseResponse", () => {
    it("should succeed when the app stores the descriptor", () => {
      // WHEN
      const result = command.parseResponse(response([0x90, 0x00]));

      // THEN
      if (isSuccessCommandResult(result)) {
        expect(result.data).toBeUndefined();
      } else {
        assert.fail("Expected a success");
      }
    });

    it.each([
      [[0x6a, 0x80], "6a80", "Invalid data"],
      [[0x6a, 0x84], "6a84", "No free slot to store the MPT descriptor"],
      [[0x6b, 0x00], "6b00", "Incorrect parameter P1 or P2"],
    ] as const)(
      "should return an XRP app error for status word %j",
      (sw, errorCode, message) => {
        // WHEN
        const result = command.parseResponse(response([sw[0], sw[1]]));

        // THEN
        if (isSuccessCommandResult(result)) {
          assert.fail("Expected an error");
        } else {
          const error = result.error as XrpAppCommandError;
          expect(error.errorCode).toBe(errorCode);
          expect(error.message).toBe(message);
        }
      },
    );
  });
});
