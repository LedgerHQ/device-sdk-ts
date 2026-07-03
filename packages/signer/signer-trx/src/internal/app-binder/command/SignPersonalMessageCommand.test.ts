import {
  ApduBuilder,
  ApduResponse,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { INS, LEDGER_CLA } from "@internal/app-binder/constants";

import { type TronAppCommandError } from "./utils/tronApplicationErrors";
import { SignPersonalMessageCommand } from "./SignPersonalMessageCommand";

describe("SignPersonalMessageCommand", () => {
  const payload = Uint8Array.from({ length: 10 }, (_, i) => i);

  describe("name", () => {
    it("should be 'SignPersonalMessage'", () => {
      expect(new SignPersonalMessageCommand({ payload, p1: 0x00 }).name).toBe(
        "SignPersonalMessage",
      );
    });
  });

  describe("getApdu", () => {
    it("should build the APDU with CLA=0xe0, INS=0x08, the given P1 and payload", () => {
      const command = new SignPersonalMessageCommand({ payload, p1: 0x80 });
      const expected = new ApduBuilder({
        cla: LEDGER_CLA,
        ins: INS.SIGN_PERSONAL_MESSAGE,
        p1: 0x80,
        p2: 0x00,
      })
        .addBufferToData(payload)
        .build();

      expect(command.getApdu().getRawApdu()).toStrictEqual(
        expected.getRawApdu(),
      );
    });
  });

  describe("parseResponse", () => {
    it("should return the 65-byte signature on the final frame", () => {
      const signature = Uint8Array.from({ length: 65 }, (_, i) => i);
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x90, 0x00]),
        data: signature,
      });
      const result = new SignPersonalMessageCommand({
        payload,
        p1: 0x00,
      }).parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(signature);
      }
    });

    it("should return a TronAppCommandError on a device error status", () => {
      const response = new ApduResponse({
        statusCode: new Uint8Array([0x69, 0x82]),
        data: new Uint8Array(0),
      });
      const result = new SignPersonalMessageCommand({
        payload,
        p1: 0x00,
      }).parseResponse(response);

      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect((result.error as TronAppCommandError).errorCode).toBe("6982");
      }
    });
  });
});
